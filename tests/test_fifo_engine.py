"""FIFO 引擎测试"""

import pytest

from src.fifo_engine import FIFOEngine, Batch, MaterialResult, CalcResult


@pytest.mark.unit
class TestFIFOEngine:
    """FIFO 引擎单元测试"""

    def setup_method(self):
        self.engine = FIFOEngine()

    # ---- FIFO-001: 基本场景 ----
    def test_fifo_001_basic(self):
        """FIFO-001: 期初+入库+出库基本场景"""
        opening = [{"material": "猪肉", "quantity": 100, "price": 10.0}]
        inbound = [{"date": "2026/4/1", "material": "猪肉", "quantity": 50, "price": 12.0}]
        outbound = [{"material": "猪肉", "quantity": 80}]

        result = self.engine.calculate(opening, inbound, outbound)
        assert len(result.materials) == 1
        m = result.materials[0]
        assert m.material_name == "猪肉"
        # 出库80: 先消耗期初100中的80，成本=80*10=800
        assert m.outbound_quantity == 80
        assert m.outbound_avg_price == 10.0
        assert m.outbound_amount == 800.0
        # 期末: 期初剩20(10.0) + 入库50(12.0) = 70
        assert m.closing_quantity == 70
        # 加权平均 = (20*10 + 50*12) / 70 = 800/70 ≈ 11.43
        assert m.closing_avg_price == round(800 / 70, 2)
        assert m.closing_amount == round(800, 2)

    # ---- FIFO-002: 仅有期初无入库/出库 ----
    def test_fifo_002_opening_only(self):
        """FIFO-002: 仅有期初无入库/出库"""
        opening = [{"material": "蒸笼", "quantity": 23, "price": 7.1}]
        inbound = []
        outbound = []

        result = self.engine.calculate(opening, inbound, outbound)
        m = result.materials[0]
        assert m.closing_quantity == 23
        assert m.closing_avg_price == 7.1
        assert m.closing_amount == round(23 * 7.1, 2)
        assert m.outbound_quantity == 0
        assert m.outbound_avg_price == 0
        assert m.outbound_amount == 0

    # ---- FIFO-003: 有入库无出库 ----
    def test_fifo_003_inbound_no_outbound(self):
        """FIFO-003: 有入库无出库"""
        opening = [{"material": "盐", "quantity": 100, "price": 5.0}]
        inbound = [{"date": "2026/4/1", "material": "盐", "quantity": 50, "price": 6.0}]
        outbound = []

        result = self.engine.calculate(opening, inbound, outbound)
        m = result.materials[0]
        assert m.closing_quantity == 150
        # 加权平均 = (100*5 + 50*6) / 150 = 800/150 ≈ 5.33
        assert m.closing_avg_price == round(800 / 150, 2)
        assert m.outbound_quantity == 0

    # ---- FIFO-004: 出库超过库存 ----
    def test_fifo_004_outbound_exceeds_stock(self):
        """FIFO-004: 出库超过库存"""
        opening = [{"material": "糖", "quantity": 10, "price": 8.0}]
        inbound = []
        outbound = [{"material": "糖", "quantity": 20}]

        result = self.engine.calculate(opening, inbound, outbound)
        m = result.materials[0]
        # 实际只能消耗10，不足部分单价记为0
        assert m.outbound_quantity == 20
        # 成本 = 10*8 = 80，不足10的单价为0
        assert m.outbound_amount == 80.0
        assert m.outbound_avg_price == round(80 / 20, 2)  # 4.0
        assert m.closing_quantity == 0
        assert len(m.warnings) > 0
        assert result.has_warnings is True

    # ---- FIFO-005: 入库数量为负（退货） ----
    def test_fifo_005_return_deduction(self):
        """FIFO-005: 入库数量为负（退货），从队尾扣减"""
        opening = [{"material": "油", "quantity": 100, "price": 10.0}]
        inbound = [
            {"date": "2026/4/1", "material": "油", "quantity": 50, "price": 12.0},
            {"date": "2026/4/2", "material": "油", "quantity": -20, "price": 12.0},  # 退货
        ]
        outbound = []

        result = self.engine.calculate(opening, inbound, outbound)
        m = result.materials[0]
        # 退货从队尾扣减: 入库50扣20剩30
        assert m.closing_quantity == 130  # 100 + 30
        # 金额 = 100*10 + 30*12 = 1360
        assert m.closing_amount == round(1360, 2)

    # ---- FIFO-006: 退货数量超过最近批次 ----
    def test_fifo_006_return_exceeds_last_batch(self):
        """FIFO-006: 退货数量超过最近批次，逐批扣减"""
        opening = [{"material": "醋", "quantity": 50, "price": 5.0}]
        inbound = [
            {"date": "2026/4/1", "material": "醋", "quantity": 30, "price": 6.0},
            {"date": "2026/4/2", "material": "醋", "quantity": -60, "price": 6.0},  # 退货60，超过30
        ]
        outbound = []

        result = self.engine.calculate(opening, inbound, outbound)
        m = result.materials[0]
        # 退货60: 先扣入库30(整批移除)，再扣期初30(50-30=20)
        assert m.closing_quantity == 20
        assert m.closing_amount == round(20 * 5.0, 2)

    # ---- FIFO-007: 进货日期为空 ----
    def test_fifo_007_empty_date(self):
        """FIFO-007: 进货日期为空，排在最后处理"""
        opening = [{"material": "酱", "quantity": 10, "price": 3.0}]
        inbound = [
            {"date": "2026/4/2", "material": "酱", "quantity": 20, "price": 4.0},
            {"date": None, "material": "酱", "quantity": 15, "price": 5.0},  # 日期为空
            {"date": "2026/4/1", "material": "酱", "quantity": 10, "price": 3.5},
        ]
        outbound = [{"material": "酱", "quantity": 25}]

        result = self.engine.calculate(opening, inbound, outbound)
        m = result.materials[0]
        # 批次顺序: 期初10(3.0) → 4/1入库10(3.5) → 4/2入库20(4.0) → 日期空入库15(5.0)
        # 出库25: 消耗期初10(30) + 4/1入库10(35) + 4/2入库5(20) = 85
        assert m.outbound_quantity == 25
        assert m.outbound_amount == 85.0
        # 期末: 4/2剩15(4.0) + 日期空15(5.0) = 30
        assert m.closing_quantity == 30

    # ---- FIFO-008: 同一物料同日多笔入库 ----
    def test_fifo_008_same_date_multiple_inbound(self):
        """FIFO-008: 同一物料同日多笔入库，按行顺序入队"""
        opening = [{"material": "猪肉", "quantity": 23, "price": 7.1}]
        inbound = [
            {"date": "2026/4/1", "material": "猪肉", "quantity": 50, "price": 12.0},  # row_index=0
            {"date": "2026/4/3", "material": "猪肉", "quantity": 20, "price": 11.0},  # row_index=1
            {"date": "2026/4/1", "material": "猪肉", "quantity": 30, "price": 13.0},  # row_index=2
        ]
        outbound = [{"material": "猪肉", "quantity": 23}]

        result = self.engine.calculate(opening, inbound, outbound)
        m = result.materials[0]
        # 批次顺序: 期初23(7.1) → 4/1入库50(12.0) → 4/1入库30(13.0) → 4/3入库20(11.0)
        # 出库23: 消耗期初23(7.1*23=163.3)
        assert m.outbound_quantity == 23
        assert m.outbound_amount == round(23 * 7.1, 2)
        # 期末: 50(12.0) + 30(13.0) + 20(11.0) = 100
        assert m.closing_quantity == 100

    # ---- FIFO-009: 多种物料混合 ----
    def test_fifo_009_multiple_materials(self):
        """FIFO-009: 多种物料混合，每种独立计算"""
        opening = [
            {"material": "A", "quantity": 100, "price": 10.0},
            {"material": "B", "quantity": 50, "price": 20.0},
        ]
        inbound = [
            {"date": "2026/4/1", "material": "A", "quantity": 30, "price": 11.0},
            {"date": "2026/4/1", "material": "B", "quantity": 20, "price": 22.0},
        ]
        outbound = [
            {"material": "A", "quantity": 50},
            {"material": "B", "quantity": 30},
        ]

        result = self.engine.calculate(opening, inbound, outbound)
        assert len(result.materials) == 2

        mat_a = next(m for m in result.materials if m.material_name == "A")
        mat_b = next(m for m in result.materials if m.material_name == "B")

        # A: 期初100(10.0)+入库30(11.0), 出库50 → 消耗期初50, 成本=500
        assert mat_a.outbound_quantity == 50
        assert mat_a.outbound_amount == 500.0
        assert mat_a.closing_quantity == 80  # 50+30

        # B: 期初50(20.0)+入库20(22.0), 出库30 → 消耗期初30, 成本=600
        assert mat_b.outbound_quantity == 30
        assert mat_b.outbound_amount == 600.0
        assert mat_b.closing_quantity == 40  # 20+20

    # ---- FIFO-010: 期初无某物料但有入库 ----
    def test_fifo_010_no_opening_with_inbound(self):
        """FIFO-010: 期初无某物料但有入库"""
        opening = []
        inbound = [
            {"date": "2026/4/1", "material": "新物料", "quantity": 100, "price": 15.0},
        ]
        outbound = [{"material": "新物料", "quantity": 40}]

        result = self.engine.calculate(opening, inbound, outbound)
        m = result.materials[0]
        assert m.outbound_quantity == 40
        assert m.outbound_amount == 600.0  # 40*15
        assert m.closing_quantity == 60

    # ---- FIFO-011: 期末库存加权平均单价 ----
    def test_fifo_011_closing_weighted_avg(self):
        """FIFO-011: 多批次剩余时加权平均正确"""
        opening = [{"material": "X", "quantity": 100, "price": 10.0}]
        inbound = [{"date": "2026/4/1", "material": "X", "quantity": 100, "price": 20.0}]
        outbound = [{"material": "X", "quantity": 50}]

        result = self.engine.calculate(opening, inbound, outbound)
        m = result.materials[0]
        # 出库50消耗期初, 期末: 期初50(10.0) + 入库100(20.0) = 150
        # 加权平均 = (50*10 + 100*20) / 150 = 2500/150 ≈ 16.67
        assert m.closing_quantity == 150
        assert m.closing_avg_price == round(2500 / 150, 2)

    # ---- FIFO-012: 出库加权平均单价 ----
    def test_fifo_012_outbound_weighted_avg(self):
        """FIFO-012: 消耗多批次时加权平均正确"""
        opening = [{"material": "Y", "quantity": 50, "price": 10.0}]
        inbound = [{"date": "2026/4/1", "material": "Y", "quantity": 50, "price": 20.0}]
        outbound = [{"material": "Y", "quantity": 80}]

        result = self.engine.calculate(opening, inbound, outbound)
        m = result.materials[0]
        # 出库80: 消耗期初50(500) + 入库30(600) = 1100
        assert m.outbound_quantity == 80
        assert m.outbound_amount == 1100.0
        assert m.outbound_avg_price == round(1100 / 80, 2)  # 13.75

    # ---- FIFO-013: PRD 示例数据验证 ----
    def test_fifo_013_prd_example(self):
        """FIFO-013: 使用 TDD conftest 中的示例数据验证"""
        opening = [
            {"material": "蒸笼",   "quantity": 23, "price": 7.1},
            {"material": "蒸笼盖", "quantity": 2,  "price": 7.1},
        ]
        inbound = [
            {"date": "2026/4/1", "material": "蒸笼",   "quantity": 23,  "price": 7.1},
            {"date": "2026/4/1", "material": "蒸笼盖", "quantity": 2,   "price": 7.1},
            {"date": "2026/4/1", "material": "日晒盐", "quantity": 200, "price": 61.5},
        ]
        outbound = [
            {"material": "蒸笼",   "quantity": 23},
            {"material": "蒸笼盖", "quantity": 2},
        ]

        result = self.engine.calculate(opening, inbound, outbound)
        assert len(result.materials) == 3

        # 蒸笼: 期初23(7.1)+入库23(7.1), 出库23 → 消耗期初23, 成本=163.3
        mat_zl = next(m for m in result.materials if m.material_name == "蒸笼")
        assert mat_zl.outbound_quantity == 23
        assert mat_zl.outbound_amount == round(23 * 7.1, 2)
        assert mat_zl.closing_quantity == 23  # 入库23剩余

        # 蒸笼盖: 期初2(7.1)+入库2(7.1), 出库2 → 消耗期初2
        mat_zlg = next(m for m in result.materials if m.material_name == "蒸笼盖")
        assert mat_zlg.outbound_quantity == 2
        assert mat_zlg.closing_quantity == 2

        # 日晒盐: 无出库
        mat_y = next(m for m in result.materials if m.material_name == "日晒盐")
        assert mat_y.outbound_quantity == 0
        assert mat_y.closing_quantity == 200

    # ---- FIFO-014: 空数据输入 ----
    def test_fifo_014_empty_data(self):
        """FIFO-014: 空数据输入，返回空结果"""
        result = self.engine.calculate([], [], [])
        assert len(result.materials) == 0
        assert result.has_warnings is False

    # ---- FIFO-015: 数值精度 ----
    def test_fifo_015_precision(self):
        """FIFO-015: 金额和单价保留2位小数"""
        opening = [{"material": "Z", "quantity": 33, "price": 7.1}]
        inbound = []
        outbound = [{"material": "Z", "quantity": 11}]

        result = self.engine.calculate(opening, inbound, outbound)
        m = result.materials[0]
        # 出库11*7.1 = 78.1
        assert m.outbound_amount == round(78.1, 2)
        # 期末22*7.1 = 156.2
        assert m.closing_amount == round(156.2, 2)
        # 检查2位小数
        assert m.outbound_avg_price == round(m.outbound_avg_price, 2)
        assert m.closing_avg_price == round(m.closing_avg_price, 2)
