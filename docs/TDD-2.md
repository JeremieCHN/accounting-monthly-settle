# 月度汇算小工具 - 技术设计文档 (里程碑二)

## 1. 里程碑范围

本里程碑对应 PRD 第二步：**FIFO 计算与输出**，包括：

- 先入先出法（FIFO）计算引擎
- 计算结果在界面上展示
- 结果导出为新的 xlsx 文件

**依赖**：里程碑一已完成（文件选择、sheet 映射、列映射、数据预览）。

---

## 2. 项目结构（变更）

```
月度汇算/
├── src/
│   ├── main.py              # 主程序入口 & GUI 界面（新增结果页面）
│   ├── excel_handler.py     # Excel 读写逻辑（新增导出方法）
│   ├── fifo_engine.py       # FIFO 计算引擎（本里程碑核心）
│   └── config.py            # 常量定义 & 列映射配置（无变更）
├── tests/
│   ├── __init__.py
│   ├── conftest.py          # 公共 fixtures（新增 FIFO 测试 fixtures）
│   ├── test_excel_handler.py
│   ├── test_config.py
│   └── test_fifo_engine.py  # FIFO 引擎测试（新增）
├── logs/
├── run.bat
├── requirements.txt
└── 汇算示例表.xlsx
```

---

## 3. 模块设计

### 3.1 fifo_engine.py — FIFO 计算引擎

**职责**：接收三个来源的映射后数据，按先入先出法计算期末库存和出库成本。

#### 3.1.1 数据结构

```python
@dataclass
class Batch:
    """入库批次"""
    quantity: float       # 批次数量（可能因退货扣减而变小）
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
    warnings: list[str]          # 警告信息（如出库超过库存）

@dataclass
class CalcResult:
    """全部物料的计算结果"""
    materials: list[MaterialResult]  # 按物料名称排序
    has_warnings: bool               # 是否存在警告
```

**Batch 字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| quantity | float | 批次剩余数量（扣减后） |
| unit_price | float | 批次单价 |
| source_type | str | `"期初"` 或 `"入库"`，标识批次来源 |
| source_date | str \| None | 进货日期，期初批次为 None |
| original_qty | float | 批次原始数量（入队时的数量，退货扣减前） |
| consumed_qty | float | 被出库消耗的数量，`original_qty - quantity` 为退货扣减部分 |

#### 3.1.2 核心类设计

```python
class FIFOEngine:
    """FIFO 先入先出计算引擎"""

    def calculate(
        self,
        opening_data: list[dict],     # 期初库存数据（已映射）
        inbound_data: list[dict],     # 入库记录数据（已映射）
        outbound_data: list[dict],    # 出库记录数据（已映射）
    ) -> CalcResult:
        """
        执行 FIFO 计算
        输入数据格式: 每行为 {column_key: value} 的字典
        返回: CalcResult 包含所有物料的计算结果
        """

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

    def _calc_closing(self, batches: list[Batch]) -> tuple[float, float, float]:
        """
        计算期末库存
        返回: (总数量, 加权平均单价, 金额)
        全部批次消耗完时返回 (0, 0, 0)
        """
```

#### 3.1.3 批次排序规则

批次队列的顺序是 FIFO 计算的核心，规则如下：

1. **期初库存**始终作为第1个批次入队
2. **入库记录**按 **进货日期升序** 排列，日期为空排最后
3. **同日多笔入库**，按 **在 Excel 中的原始行顺序** 入队（即先出现的行先入队）

示例：猪肉有3笔入库记录

| 行号 | 进货日期 | 数量 | 单价 | 批次顺序 |
|------|----------|------|------|----------|
| 5 | 2026/4/1 | 50 | 12.0 | 批次2（期初后第1笔） |
| 12 | 2026/4/1 | 30 | 13.0 | 批次3（同日，行号12 > 5，排在后面） |
| 8 | 2026/4/3 | 20 | 11.0 | 批次4（日期最晚，排最后） |

排序逻辑伪代码：

```python
# 入库记录排序 key: (日期, 原始行号)
# 日期为空时视为最大值（排最后）
sorted_inbound = sorted(
    inbound_records,
    key=lambda r: (r["date"] is None, r["date"] or "", r["row_index"])
)
```

#### 3.1.4 算法流程

```
对每种物料 material:
    │
    ▼
1. 构建批次队列 batches = _build_batches(material, opening, inbound)
    │
    │  1a. 期初库存入队: Batch(期初数量, 期初单价, source_type="期初", source_date=None, original_qty=期初数量, consumed_qty=0)
    │  1b. 入库记录按 (日期升序, 原始行号升序) 排列，日期为空排最后
    │  1c. 逐条入库:
    │      - 数量 > 0: batches.append(Batch(数量, 单价, source_type="入库", source_date=日期, original_qty=数量, consumed_qty=0))
    │      - 数量 < 0: 从队尾开始扣减
    │        while 剩余退货量 > 0 and batches 非空:
    │            last = batches[-1]
    │            if |退货量| >= last.quantity:
    │                剩余退货量 -= last.quantity
    │                batches.pop()
    │            else:
    │                last.quantity -= |退货量|
    │                剩余退货量 = 0
    │        if 剩余退货量 > 0:
    │            warnings.append("退货数量超过可用库存")
    │
    ▼
2. 汇总出库数量 outbound_qty = sum(出库记录中该物料的数量)
    │
    ▼
3. 消耗出库 batches, cost, qty, warns = _consume_outbound(batches, outbound_qty)
    │
    │  while 剩余出库量 > 0 and batches 非空:
    │      first = batches[0]
    │      if 剩余出库量 <= first.quantity:
    │          cost += 剩余出库量 × first.unit_price
    │          first.consumed_qty += 剩余出库量
    │          first.quantity -= 剩余出库量
    │          剩余出库量 = 0
    │      else:
    │          cost += first.quantity × first.unit_price
    │          first.consumed_qty += first.quantity
    │          剩余出库量 -= first.quantity
    │          batches.pop(0)
    │  if 剩余出库量 > 0:
    │      warnings.append("出库数量超过可用库存，不足部分单价记为0")
    │
    ▼
4. 计算结果
    │  期末库存 = _calc_closing(batches)
    │  出库单价 = cost / qty (qty > 0 时)
    │  出库金额 = cost
    │
    ▼
5. 组装 MaterialResult（batches 保留完整批次明细，含消耗情况）
```

#### 3.1.5 边界情况处理

| 场景 | 处理方式 | 日志 |
|------|----------|------|
| 出库数量 > 可用库存 | 按实际库存计算，不足部分单价记为0，记录警告 | WARNING: 物料 {name} 出库数量超过可用库存 |
| 入库记录中数量为负（退货） | 从最近批次（队尾）扣减 | DEBUG: 物料 {name} 退货扣减批次 |
| 退货数量 > 最近批次库存 | 逐批扣减至队首，仍不足则记录警告 | WARNING: 物料 {name} 退货数量超过可用库存 |
| 某物料仅有期初无入库/出库 | 期末库存 = 期初库存 | DEBUG: 物料 {name} 无入库/出库记录 |
| 某物料有入库无出库 | 期末库存 = 期初 + 入库合计 | DEBUG: 物料 {name} 无出库记录 |
| 进货日期为空 | 排在最后处理（排序时空值视为最大值） | DEBUG: 物料 {name} 存在日期为空的入库记录 |
| 同一物料同日多笔入库 | 按在表格中的行顺序入队 | DEBUG: 物料 {name} 同日多笔入库 |
| 期初库存中无某物料 | 视为期初数量为0，从入库记录开始建队 | DEBUG: 物料 {name} 无期初库存 |
| 出库记录中无某物料 | 出库数量为0，期末库存 = 期初 + 入库 | DEBUG: 物料 {name} 无出库记录 |
| 期末库存数量为0 | 加权平均单价记为0，金额为0 | DEBUG: 物料 {name} 期末库存为0 |

#### 3.1.5 数值精度

- 所有金额和单价计算使用 `float`
- 最终输出时，金额和单价保留 **2 位小数**（四舍五入）
- 加权平均单价 = 总金额 / 总数量，仅在数量 > 0 时计算，否则为 0
- 出库单价 = 出库总成本 / 出库总数量，仅在出库总数量 > 0 时计算，否则为 0

---

### 3.2 excel_handler.py — 新增导出方法

**职责**：将 CalcResult 写入新的 xlsx 文件。

#### 3.2.1 新增类

```python
class ExcelExporter:
    """Excel 结果导出"""

    def export(self, result: CalcResult, output_path: str) -> None:
        """
        将计算结果导出为 xlsx 文件
        输出文件包含2个 sheet:
          - 期末库存: 物料名称、数量、单价、金额
          - 出库成本: 物料名称、出库数量、单价、出库金额
        """
```

#### 3.2.2 导出格式

**Sheet 1: 期末库存**

| 列 | 宽度 | 对齐 | 格式 |
|----|------|------|------|
| 物料名称 | 20 | 左对齐 | 文本 |
| 数量 | 12 | 右对齐 | 数值，2位小数 |
| 单价 | 12 | 右对齐 | 数值，2位小数 |
| 金额 | 14 | 右对齐 | 数值，2位小数 |

**Sheet 2: 出库成本**

| 列 | 宽度 | 对齐 | 格式 |
|----|------|------|------|
| 物料名称 | 20 | 左对齐 | 文本 |
| 出库数量 | 12 | 右对齐 | 数值，2位小数 |
| 单价 | 12 | 右对齐 | 数值，2位小数 |
| 出库金额 | 14 | 右对齐 | 数值，2位小数 |

- 表头行加粗，背景色浅灰
- 有警告的物料行背景色标黄
- 末尾增加汇总行：数量合计、金额合计

#### 3.2.3 默认文件名

```
汇算结果_YYYYMMDD.xlsx
```

日期取当前系统日期，格式 `YYYYMMDD`。

---

### 3.3 main.py — GUI 新增结果展示

**职责**：在现有界面基础上，将"开始计算"按钮连接到 FIFO 引擎，在入库 TAB 中展示批次明细，并新增"计算结果"tab 展示汇总。

#### 3.3.1 界面变更

**入库记录 TAB 变更**：计算完成后，在入库 TAB 的数据预览下方新增"批次明细"区域，展示该来源中每种物料的批次队列及消耗情况。

```
┌─────────────────────────────────────────────────────┐
│  月度汇算小工具                                        │
├─────────────────────────────────────────────────────┤
│  [入库记录] [期初库存] [出库记录]  |  [计算结果]        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─ 入库记录 tab（计算后） ──────────────────────────┐ │
│  │                                                  │ │
│  │  文件: xxx.xlsx   Sheet: [▼]                     │ │
│  │  行范围 | 列映射  （同里程碑一）                    │ │
│  │                                                  │ │
│  │  ── 数据预览 ──                                  │ │
│  │  ┌──────────────────────────────────────────┐    │ │
│  │  │ 行号 │ 进货日期 │ 物料名称 │ 数量 │ 单价  │    │ │
│  │  │ ...  │ ...     │ ...     │ ...  │ ...   │    │ │
│  │  └──────────────────────────────────────────┘    │ │
│  │  共 XX 行 | 物料种类: XX                          │ │
│  │                                                  │ │
│  │  ── 批次明细 ──  ← 计算后新增                     │ │
│  │  物料: [▼ 选择物料]                               │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │
│  │  │ 来源 │ 日期     │ 原始数量 │ 消耗数量 │ 剩余数量 │ 单价  │ │
│  │  │ 期初 │ -        │ 23      │ 23      │ 0       │ 7.1   │ │
│  │  │ 入库 │ 2026/4/1 │ 23      │ 0       │ 23      │ 7.1   │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │  出库合计: 23  出库成本: 163.30  期末结余: 23      │ │
│  │                                                  │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ 计算结果 tab ──────────────────────────────────┐  │
│  │                                                 │  │
│  │  ── 期末库存 ──                                  │  │
│  │  ┌──────────────────────────────────────┐       │  │
│  │  │ 物料名称 │ 数量  │ 单价  │ 金额      │       │  │
│  │  │ ...      │ ...   │ ...   │ ...       │       │  │
│  │  └──────────────────────────────────────┘       │  │
│  │                                                 │  │
│  │  ── 出库成本 ──                                  │  │
│  │  ┌──────────────────────────────────────┐       │  │
│  │  │ 物料名称 │ 出库数量 │ 单价 │ 出库金额 │       │  │
│  │  │ ...      │ ...     │ ...  │ ...      │       │  │
│  │  └──────────────────────────────────────┘       │  │
│  │                                                 │  │
│  │  ⚠ 警告: 物料X 出库超过库存                      │  │
│  │                                                 │  │
│  │  [导出结果]                                      │  │
│  └─────────────────────────────────────────────────┘  │
│                                                      │
│                              [开始计算 →]             │
└──────────────────────────────────────────────────────┘
```

#### 3.3.2 入库 TAB 批次明细区域

计算完成后，入库 TAB 底部新增批次明细区域，包含：

1. **物料选择下拉框**：列出所有物料名称，切换后展示对应物料的批次队列
2. **批次明细表格** (`ttk.Treeview`)：

| 列 | 说明 | 对齐 |
|----|------|------|
| 来源 | "期初" 或 "入库" | 居中 |
| 日期 | 进货日期，期初显示 "-" | 居中 |
| 原始数量 | 批次入队时的数量 | 右对齐 |
| 消耗数量 | 被出库消耗的数量 | 右对齐 |
| 剩余数量 | 消耗后剩余数量 | 右对齐 |
| 单价 | 批次单价 | 右对齐 |

3. **汇总行**：出库合计数量、出库总成本、期末结余数量

批次明细表格行样式：
- 消耗数量 > 0 且剩余数量 = 0 的行（已完全消耗）：灰色文字
- 消耗数量 > 0 且剩余数量 > 0 的行（部分消耗）：正常显示
- 剩余数量 > 0 且消耗数量 = 0 的行（未消耗）：正常显示

#### 3.3.3 交互逻辑变更

| 事件 | 处理 |
|------|------|
| 点击"开始计算" | 校验映射完整性 → 调用 `FIFOEngine.calculate()` → 在入库 TAB 显示批次明细 → 新增"计算结果"tab 并展示汇总 → 切换到"计算结果"tab |
| 切换物料下拉框 | 更新批次明细表格为所选物料的批次队列 |
| 点击"导出结果" | 弹出保存文件对话框（默认文件名 `汇算结果_YYYYMMDD.xlsx`） → 调用 `ExcelExporter.export()` → 提示导出成功 |
| 计算过程出错 | 弹出错误提示框，日志记录 ERROR |
| 切换到入库 TAB | 若已计算，显示批次明细区域；若未计算，隐藏批次明细区域 |

#### 3.3.3 状态管理变更

```python
@dataclass
class AppState:
    sources: dict[InputSource, SourceState]
    calc_result: CalcResult | None = None   # 新增：计算结果
```

#### 3.3.4 结果展示表格

使用 `ttk.Treeview` 展示两个结果表，与数据预览表格风格一致：

- 期末库存表：列 = 物料名称、数量、单价、金额
- 出库成本表：列 = 物料名称、出库数量、单价、出库金额
- 有警告的物料行背景色标黄（tag: `"warning"`）
- 数值列右对齐，保留2位小数

---

## 4. 日志埋点

### 4.1 里程碑二新增日志

| 模块 | 函数 | 级别 | 日志内容 |
|------|------|------|----------|
| fifo_engine | calculate | INFO | 开始 FIFO 计算，物料种类数: {count} |
| fifo_engine | calculate | INFO | FIFO 计算完成，物料种类数: {count}，警告数: {warn_count} |
| fifo_engine | _build_batches | DEBUG | 物料 {name} 构建批次队列，批次数: {count} |
| fifo_engine | _build_batches | WARNING | 物料 {name} 退货数量超过可用库存，剩余退货量: {qty} |
| fifo_engine | _consume_outbound | WARNING | 物料 {name} 出库数量超过可用库存，不足: {qty} |
| fifo_engine | _consume_outbound | DEBUG | 物料 {name} 出库消耗，出库成本: {cost} |
| fifo_engine | _calc_closing | DEBUG | 物料 {name} 期末库存: 数量={qty}, 单价={price}, 金额={amount} |
| excel_handler | export | INFO | 导出结果到文件: {output_path} |
| excel_handler | export | ERROR | 导出文件失败: {output_path}, 原因: {error} |
| main | _on_start_calc | INFO | 用户点击开始计算 |
| main | _on_start_calc | ERROR | 计算失败: {error} |
| main | _on_export | INFO | 用户导出结果到: {file_path} |
| main | _on_export | ERROR | 导出失败: {error} |

---

## 5. 测试规范

### 5.1 新增测试文件

```
tests/
├── test_fifo_engine.py      # FIFO 引擎测试（新增）
└── test_excel_handler.py    # 补充导出测试
```

### 5.2 新增 Fixtures (conftest.py)

```python
@pytest.fixture
def opening_data():
    """期初库存映射后数据"""
    return [
        {"material": "蒸笼",   "quantity": 23, "price": 7.1},
        {"material": "蒸笼盖", "quantity": 2,  "price": 7.1},
    ]

@pytest.fixture
def inbound_data():
    """入库记录映射后数据"""
    return [
        {"date": "2026/4/1", "material": "蒸笼",   "quantity": 23,  "price": 7.1},
        {"date": "2026/4/1", "material": "蒸笼盖", "quantity": 2,   "price": 7.1},
        {"date": "2026/4/1", "material": "日晒盐", "quantity": 200, "price": 61.5},
    ]

@pytest.fixture
def outbound_data():
    """出库记录映射后数据"""
    return [
        {"material": "蒸笼",   "quantity": 23},
        {"material": "蒸笼盖", "quantity": 2},
    ]
```

### 5.3 FIFO 引擎测试用例

| ID | 测试内容 | 预期结果 |
|----|----------|----------|
| FIFO-001 | 基本场景：期初+入库+出库 | 期末库存和出库成本计算正确 |
| FIFO-002 | 仅有期初无入库/出库 | 期末库存 = 期初库存，出库成本为0 |
| FIFO-003 | 有入库无出库 | 期末库存 = 期初 + 入库合计，出库成本为0 |
| FIFO-004 | 出库超过库存 | 不足部分单价记为0，记录警告 |
| FIFO-005 | 入库数量为负（退货） | 从队尾扣减最近批次 |
| FIFO-006 | 退货数量超过最近批次 | 逐批扣减至队首 |
| FIFO-007 | 进货日期为空 | 排在最后处理 |
| FIFO-008 | 同一物料同日多笔入库 | 按行顺序入队 |
| FIFO-009 | 多种物料混合 | 每种物料独立计算，互不影响 |
| FIFO-010 | 期初无某物料但有入库 | 从入库记录开始建队 |
| FIFO-011 | 期末库存加权平均单价 | 多批次剩余时加权平均正确 |
| FIFO-012 | 出库加权平均单价 | 消耗多批次时加权平均正确 |
| FIFO-013 | PRD 示例数据验证 | 计算结果与 PRD 示例一致 |
| FIFO-014 | 空数据输入 | 返回空结果，无异常 |
| FIFO-015 | 数值精度 | 金额和单价保留2位小数 |

### 5.4 导出测试用例

| ID | 测试内容 | 预期结果 |
|----|----------|----------|
| EXP-001 | 导出正常结果 | 文件包含2个 sheet，数据正确 |
| EXP-002 | 导出含警告的结果 | 警告行标黄 |
| EXP-003 | 导出空结果 | 文件包含2个 sheet，仅有表头 |
| EXP-004 | 导出路径不存在 | 自动创建目录 |
| EXP-005 | 导出文件被占用 | 抛出异常，日志记录 ERROR |
| EXP-006 | 导出数值格式 | 数值列保留2位小数 |

### 5.6 覆盖率要求

- 里程碑二核心逻辑（fifo_engine.py）行覆盖率 **≥ 90%**
- 导出逻辑（ExcelExporter）行覆盖率 **≥ 85%**
- GUI 代码（main.py）不做覆盖率要求，通过手工测试验证

---

## 6. 实现步骤

### 步骤 1：实现 FIFO 引擎

1. 在 `fifo_engine.py` 中实现数据结构（`Batch`, `MaterialResult`, `CalcResult`）
2. 实现 `FIFOEngine.calculate()` 主方法
3. 实现 `_build_batches()` 批次构建
4. 实现 `_consume_outbound()` 出库消耗
5. 实现 `_calc_closing()` 期末库存计算
6. 编写 `test_fifo_engine.py` 全部测试用例
7. 运行测试，确保全部通过

### 步骤 2：实现导出功能

1. 在 `excel_handler.py` 中实现 `ExcelExporter` 类
2. 编写导出测试用例
3. 运行测试，确保全部通过

### 步骤 3：集成到 GUI

1. 在 `main.py` 中新增"计算结果"tab
2. 修改 `_on_start_calc()` 连接 FIFO 引擎
3. 实现结果展示逻辑（两个 Treeview）
4. 实现"导出结果"按钮逻辑
5. 手工测试完整流程

---

## 7. 里程碑二验收检查清单

- [ ] FIFO 计算结果与手工计算一致（以示例表验证）
- [ ] 正确处理退货（数量为负的入库记录）
- [ ] 正确处理出库超过库存的边界情况
- [ ] 期末库存加权平均单价计算正确
- [ ] 出库成本加权平均单价计算正确
- [ ] 入库 TAB 展示批次明细（物料选择 + 批次表格 + 汇总）
- [ ] 批次排序正确：期初优先，入库按日期+行号排序
- [ ] 批次消耗记录正确：每个批次的原始数量、消耗数量、剩余数量
- [ ] 计算结果 tab 正确展示期末库存表和出库成本表
- [ ] 有警告的物料行标黄
- [ ] 结果可导出为新的 xlsx 文件（含3个 sheet：期末库存、出库成本、批次明细）
- [ ] 导出文件格式与 PRD 要求一致
- [ ] 默认文件名格式为 `汇算结果_YYYYMMDD.xlsx`
- [ ] 日志正常输出到 `logs/app.log`
- [ ] 单元测试全部通过，fifo_engine.py 覆盖率 ≥ 90%
