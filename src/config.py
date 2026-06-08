"""月度汇算小工具 - 常量定义 & 列映射配置"""

from dataclasses import dataclass, field
from enum import Enum


class InputSource(Enum):
    """输入来源枚举"""
    INBOUND = "入库记录"
    OPENING = "期初库存"
    OUTBOUND = "出库记录"


@dataclass
class ColumnDef:
    """列定义"""
    key: str               # 内部标识，如 "material"
    display: str           # 界面显示名，如 "物料名称"
    required: bool = True  # 是否必需列
    aliases: list[str] = field(default_factory=list)  # 自动匹配时的候选列名列表


# 每个来源的必需列定义
SOURCE_COLUMNS: dict[InputSource, list[ColumnDef]] = {
    InputSource.INBOUND: [
        ColumnDef(key="date",     display="进货日期", required=True, aliases=["进货日期", "日期", "入库日期"]),
        ColumnDef(key="material", display="物料名称", required=True, aliases=["物料名称", "物料", "品名"]),
        ColumnDef(key="quantity", display="数量",     required=True, aliases=["数量", "入库数量"]),
        ColumnDef(key="price",    display="单价",     required=True, aliases=["单价", "入库单价"]),
    ],
    InputSource.OPENING: [
        ColumnDef(key="material", display="物料名称", required=True, aliases=["物料名称", "物料", "品名"]),
        ColumnDef(key="quantity", display="数量",     required=True, aliases=["数量", "期初数量"]),
        ColumnDef(key="price",    display="单价",     required=True, aliases=["单价", "期初单价"]),
    ],
    InputSource.OUTBOUND: [
        ColumnDef(key="material", display="物料名称", required=True, aliases=["物料名称", "物料", "品名"]),
        ColumnDef(key="quantity", display="数量",     required=True, aliases=["数量", "出库数量"]),
    ],
}

# 预览默认行数
PREVIEW_DEFAULT_ROWS = 20

# 异常检测规则
ANOMALY_RULES = {
    "quantity_negative": {"key": "quantity", "condition": "<0",  "label": "数量为负"},
    "date_empty":        {"key": "date",     "condition": "is_empty", "label": "日期为空"},
    "price_zero":        {"key": "price",    "condition": "==0",  "label": "单价为0"},
}

# 异常规则适用的来源
ANOMALY_SOURCE_APPLICABILITY = {
    "quantity_negative": [InputSource.INBOUND, InputSource.OPENING, InputSource.OUTBOUND],
    "date_empty":        [InputSource.INBOUND],
    "price_zero":        [InputSource.INBOUND, InputSource.OPENING],
}
