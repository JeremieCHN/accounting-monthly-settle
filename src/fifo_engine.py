"""月度汇算小工具 - FIFO 计算引擎"""

import logging
from dataclasses import dataclass, field

logger = logging.getLogger("monthly_settlement")


@dataclass
class Batch:
    """入库批次"""
    quantity: float       # 批次剩余数量（扣减后）
    unit_price: float     # 批次单价
    source_type: str      # 来源类型: "期初" | "入库"
    source_date: str | None  # 进货日期（期初批次为 None）
    original_qty: float   # 批次原始数量（扣减前）
    consumed_qty: float   # 被出库消耗的数量


@dataclass
class MaterialResult:
    """单种物料的计算结果"""
    material_name: str           # 物料名称
    closing_quantity: float      # 期末数量
    closing_avg_price: float     # 期末加权平均单价
    closing_amount: float        # 期末金额 = 数量 × 单价
    outbound_quantity: float     # 出库数量
    outbound_avg_price: float    # 出库加权平均单价
    outbound_amount: float       # 出库总金额
    batches: list[Batch]         # 批次明细（含消耗情况）
    warnings: list[str]          # 警告信息


@dataclass
class CalcResult:
    """全部物料的计算结果"""
    materials: list[MaterialResult]  # 按物料名称排序
    has_warnings: bool               # 是否存在警告


class FIFOEngine:
    """FIFO 先入先出计算引擎"""

    def calculate(
        self,
        opening_data: list[dict],
        inbound_data: list[dict],
        outbound_data: list[dict],
    ) -> CalcResult:
        """
        执行 FIFO 计算
        输入数据格式: 每行为 {column_key: value} 的字典
        返回: CalcResult 包含所有物料的计算结果
        """
        # 收集所有物料名称
        all_materials = set()
        for row in opening_data:
            name = row.get("material")
            if name is not None:
                all_materials.add(str(name))
        for row in inbound_data:
            name = row.get("material")
            if name is not None:
                all_materials.add(str(name))
        for row in outbound_data:
            name = row.get("material")
            if name is not None:
                all_materials.add(str(name))

        logger.info(f"开始 FIFO 计算，物料种类数: {len(all_materials)}")

        results: list[MaterialResult] = []
        has_warnings = False

        for material_name in sorted(all_materials):
            # 1. 构建批次队列
            batches = self._build_batches(material_name, opening_data, inbound_data)

            # 2. 汇总出库数量
            outbound_qty = 0.0
            for row in outbound_data:
                if str(row.get("material")) == material_name:
                    qty = row.get("quantity", 0)
                    if isinstance(qty, (int, float)):
                        outbound_qty += float(qty)

            # 3. 消耗出库
            batches, cost, consumed_qty, warns = self._consume_outbound(
                batches, outbound_qty, material_name
            )

            # 4. 计算期末库存
            closing_qty, closing_avg_price, closing_amount = self._calc_closing(batches)

            # 5. 出库加权平均
            outbound_avg_price = round(cost / consumed_qty, 2) if consumed_qty > 0 else 0.0
            outbound_amount = round(cost, 2)

            if warns:
                has_warnings = True

            results.append(MaterialResult(
                material_name=material_name,
                closing_quantity=round(closing_qty, 2),
                closing_avg_price=round(closing_avg_price, 2),
                closing_amount=round(closing_amount, 2),
                outbound_quantity=round(consumed_qty, 2),
                outbound_avg_price=outbound_avg_price,
                outbound_amount=outbound_amount,
                batches=batches,
                warnings=warns,
            ))

        logger.info(f"FIFO 计算完成，物料种类数: {len(all_materials)}，警告数: {sum(len(r.warnings) for r in results)}")

        return CalcResult(materials=results, has_warnings=has_warnings)

    def _build_batches(
        self,
        material_name: str,
        opening_data: list[dict],
        inbound_data: list[dict],
    ) -> list[Batch]:
        """
        为指定物料构建入库批次队列
        1. 期初库存作为第一个批次
        2. 按进货日期升序，将入库记录逐条入队
           - 数量为正：新增批次
           - 数量为负（退货）：从队尾扣减
        """
        batches: list[Batch] = []

        # 1a. 期初库存入队
        has_opening = False
        for row in opening_data:
            if str(row.get("material")) == material_name:
                qty = row.get("quantity", 0)
                price = row.get("price", 0)
                if isinstance(qty, (int, float)) and isinstance(price, (int, float)):
                    qty = float(qty)
                    price = float(price)
                    batches.append(Batch(
                        quantity=qty,
                        unit_price=price,
                        source_type="期初",
                        source_date=None,
                        original_qty=qty,
                        consumed_qty=0,
                    ))
                    has_opening = True
                    break  # 期初库存每种物料只有一条

        if not has_opening:
            logger.debug(f"物料 {material_name} 无期初库存")

        # 1b. 入库记录按 (日期升序, 原始行号升序) 排列
        inbound_records = []
        for idx, row in enumerate(inbound_data):
            if str(row.get("material")) == material_name:
                inbound_records.append({**row, "_row_index": idx})

        # 排序: 日期为空排最后
        sorted_inbound = sorted(
            inbound_records,
            key=lambda r: (r.get("date") is None or r.get("date") == "", r.get("date") or "", r.get("_row_index", 0))
        )

        # 检查同日多笔
        date_counts: dict[str, int] = {}
        for r in sorted_inbound:
            d = r.get("date")
            if d:
                date_counts[str(d)] = date_counts.get(str(d), 0) + 1
        for d, c in date_counts.items():
            if c > 1:
                logger.debug(f"物料 {material_name} 同日多笔入库")

        # 检查日期为空
        for r in sorted_inbound:
            d = r.get("date")
            if d is None or str(d).strip() == "":
                logger.debug(f"物料 {material_name} 存在日期为空的入库记录")
                break

        # 1c. 逐条入库
        for record in sorted_inbound:
            qty = record.get("quantity", 0)
            price = record.get("price", 0)
            date = record.get("date")

            if not isinstance(qty, (int, float)):
                continue
            if not isinstance(price, (int, float)):
                continue

            qty = float(qty)
            price = float(price)
            date_str = str(date) if date is not None and str(date).strip() != "" else None

            if qty >= 0:
                # 正常入库：新增批次
                batches.append(Batch(
                    quantity=qty,
                    unit_price=price,
                    source_type="入库",
                    source_date=date_str,
                    original_qty=qty,
                    consumed_qty=0,
                ))
            else:
                # 退货：从队尾扣减
                remaining = abs(qty)
                while remaining > 0 and batches:
                    last = batches[-1]
                    if remaining >= last.quantity:
                        remaining -= last.quantity
                        batches.pop()
                    else:
                        last.quantity -= remaining
                        remaining = 0

                if remaining > 0:
                    logger.warning(f"物料 {material_name} 退货数量超过可用库存，剩余退货量: {remaining}")
                    # 记录警告，但继续处理

        logger.debug(f"物料 {material_name} 构建批次队列，批次数: {len(batches)}")

        # 无入库/出库日志由调用方判断
        if not inbound_records:
            logger.debug(f"物料 {material_name} 无入库记录")

        return batches

    def _consume_outbound(
        self,
        batches: list[Batch],
        outbound_qty: float,
        material_name: str,
    ) -> tuple[list[Batch], float, float, list[str]]:
        """
        从批次队列中消耗出库数量
        返回: (剩余批次, 出库总成本, 出库总数量, 警告列表)
        """
        warnings: list[str] = []
        remaining = outbound_qty
        cost = 0.0

        while remaining > 0 and batches:
            first = batches[0]
            if remaining <= first.quantity:
                cost += remaining * first.unit_price
                first.consumed_qty += remaining
                first.quantity -= remaining
                remaining = 0
            else:
                cost += first.quantity * first.unit_price
                first.consumed_qty += first.quantity
                remaining -= first.quantity
                batches.pop(0)

        if remaining > 0:
            warnings.append(f"物料 {material_name} 出库数量超过可用库存，不足: {remaining:.2f}")
            logger.warning(f"物料 {material_name} 出库数量超过可用库存，不足: {remaining}")
            # 不足部分单价记为0，出库数量仍为完整请求数量
            consumed_qty = outbound_qty
        else:
            consumed_qty = outbound_qty

        logger.debug(f"物料 {material_name} 出库消耗，出库成本: {cost:.2f}")

        return batches, cost, consumed_qty, warnings

    def _calc_closing(self, batches: list[Batch]) -> tuple[float, float, float]:
        """
        计算期末库存
        返回: (总数量, 加权平均单价, 金额)
        全部批次消耗完时返回 (0, 0, 0)
        """
        total_qty = sum(b.quantity for b in batches)
        if total_qty <= 0:
            return 0.0, 0.0, 0.0

        total_amount = sum(b.quantity * b.unit_price for b in batches)
        avg_price = total_amount / total_qty

        return total_qty, avg_price, total_amount
