# 月度汇算小工具 - 技术设计文档 (里程碑一)

## 1. 里程碑范围

本里程碑对应 PRD 第一步：**文件选择与数据预览**，包括：

- 选择 xlsx 文件并展示所有 sheet 名称
- 为3个输入来源分别指定 sheet
- 自动匹配列名，支持手动调整
- 预览映射后的数据（前20行 + 加载更多）
- 忽略未映射的额外列
- 标注异常数据（数量为负、日期为空、单价为0等）

**不包含**：FIFO 计算、结果导出（属于里程碑二）。

---

## 2. 项目结构

```
月度汇算/
├── src/
│   ├── main.py              # 主程序入口 & GUI 界面
│   ├── excel_handler.py     # Excel 读写逻辑
│   ├── fifo_engine.py       # FIFO 计算引擎（里程碑二实现，当前为空模块）
│   └── config.py            # 常量定义 & 列映射配置
├── tests/
│   ├── __init__.py
│   ├── test_excel_handler.py
│   └── test_config.py
├── logs/                    # 日志输出目录
├── run.bat                  # 开发运行脚本
├── requirements.txt         # 依赖
└── 汇算示例表.xlsx          # 示例数据
```

---

## 3. 模块设计

### 3.1 config.py — 常量与列映射配置

**职责**：定义输入来源的元数据、必需列名、自动匹配规则。

```python
# 输入来源枚举
class InputSource(Enum):
    INBOUND = "入库记录"
    OPENING = "期初库存"
    OUTBOUND = "出库记录"

# 每个来源的必需列定义
SOURCE_COLUMNS = {
    InputSource.INBOUND: [
        ColumnDef(key="date",     display="进货日期", required=True,  aliases=["进货日期", "日期", "入库日期"]),
        ColumnDef(key="material", display="物料名称", required=True,  aliases=["物料名称", "物料", "品名"]),
        ColumnDef(key="quantity", display="数量",     required=True,  aliases=["数量", "入库数量"]),
        ColumnDef(key="price",    display="单价",     required=True,  aliases=["单价", "入库单价"]),
    ],
    InputSource.OPENING: [
        ColumnDef(key="material", display="物料名称", required=True,  aliases=["物料名称", "物料", "品名"]),
        ColumnDef(key="quantity", display="数量",     required=True,  aliases=["数量", "期初数量"]),
        ColumnDef(key="price",    display="单价",     required=True,  aliases=["单价", "期初单价"]),
    ],
    InputSource.OUTBOUND: [
        ColumnDef(key="material", display="物料名称", required=True,  aliases=["物料名称", "物料", "品名"]),
        ColumnDef(key="quantity", display="数量",     required=True,  aliases=["数量", "出库数量"]),
    ],
}

# 预览默认行数
PREVIEW_DEFAULT_ROWS = 20

# 异常检测规则
ANOMALY_RULES = {
    "quantity_negative": {"key": "quantity", "condition": "<0", "label": "数量为负"},
    "date_empty":        {"key": "date",     "condition": "is_empty", "label": "日期为空"},
    "price_zero":        {"key": "price",    "condition": "==0", "label": "单价为0"},
}
```

**数据类 ColumnDef**：

| 字段 | 类型 | 说明 |
|------|------|------|
| key | str | 内部标识，如 `"material"` |
| display | str | 界面显示名，如 `"物料名称"` |
| required | bool | 是否必需列 |
| aliases | list[str] | 自动匹配时的候选列名列表 |

### 3.2 excel_handler.py — Excel 读写逻辑

**职责**：封装 openpyxl 操作，提供文件读取、sheet 列表、数据解析、列自动匹配接口。

#### 3.2.1 类设计

```python
class ExcelHandler:
    """Excel 文件读取与解析"""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self._workbook = None

    def get_sheet_names(self) -> list[str]:
        """返回文件中所有 sheet 名称"""

    def read_sheet(self, sheet_name: str) -> tuple[list[str], list[dict]]:
        """
        读取指定 sheet 的数据
        返回: (列名列表, 数据行列表)
        每行数据为 {列名: 值} 的字典
        """

    def close(self):
        """关闭工作簿"""

class ColumnMapper:
    """列名自动匹配与手动映射"""

    def auto_match(self, sheet_columns: list[str], source: InputSource) -> dict[str, str | None]:
        """
        自动匹配: 将 sheet 列名映射到 source 的必需列
        返回: {column_key: matched_sheet_column_name | None}
        匹配规则: 精确匹配 aliases 中的任一名称
        """

    def validate_mapping(self, mapping: dict[str, str | None], source: InputSource) -> list[str]:
        """
        校验映射完整性
        返回: 未映射的必需列的 display 名称列表（空列表表示校验通过）
        """

class DataAnalyzer:
    """数据预览与异常检测"""

    def preview(self, data: list[dict], mapping: dict[str, str],
                rows: int = 20) -> list[dict]:
        """
        返回映射后的预览数据（仅包含已映射列）
        """

    def get_stats(self, data: list[dict], mapping: dict[str, str]) -> dict:
        """
        返回统计信息: {total_rows, material_count}
        """

    def detect_anomalies(self, data: list[dict], mapping: dict[str, str],
                         source: InputSource) -> list[AnomalyRecord]:
        """
        检测异常数据
        返回异常记录列表，每条包含: {row_index, column, value, rule, label}
        """
```

#### 3.2.2 数据流

```
用户选择文件
    │
    ▼
ExcelHandler(file_path).get_sheet_names()  →  展示 sheet 下拉框
    │
    ▼ 用户选择 sheet
ExcelHandler.read_sheet(sheet_name)  →  (columns, rows)
    │
    ▼
ColumnMapper.auto_match(columns, source)  →  自动匹配结果
    │
    ▼ 用户确认/调整映射
DataAnalyzer.preview(rows, mapping)  →  预览表格
DataAnalyzer.get_stats(rows, mapping)  →  统计信息
DataAnalyzer.detect_anomalies(rows, mapping, source)  →  异常标注
```

#### 3.2.3 异常检测规则

| 规则ID | 适用来源 | 检测条件 | 标注文本 |
|--------|----------|----------|----------|
| quantity_negative | 全部 | 数量列值 < 0 | 数量为负 |
| date_empty | 入库记录 | 日期列值为空/None | 日期为空 |
| price_zero | 入库记录、期初库存 | 单价列值 == 0 | 单价为0 |

异常记录结构：

```python
@dataclass
class AnomalyRecord:
    row_index: int       # 行号（从1开始，不含表头）
    column: str          # 列显示名
    value: Any           # 原始值
    rule: str            # 规则ID
    label: str           # 标注文本
```

### 3.3 main.py — GUI 界面

**职责**：tkinter 单窗口应用，分步骤切换页面。

#### 3.3.1 页面结构

```
┌─────────────────────────────────────────────────┐
│  月度汇算小工具                                    │
├─────────────────────────────────────────────────┤
│  [页面指示器] ① 文件选择  ② 列映射与预览           │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─ 页面1: 文件选择 ──────────────────────────┐  │
│  │                                             │  │
│  │  入库记录:  [选择文件]  [sheet▼]             │  │
│  │  期初库存:  [选择文件]  [sheet▼]             │  │
│  │  出库记录:  [选择文件]  [sheet▼]             │  │
│  │                                             │  │
│  │            [下一步 →]                        │  │
│  └─────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ 页面2: 列映射与预览 ──────────────────────┐  │
│  │                                             │  │
│  │  入库记录 列映射:                            │  │
│  │    进货日期: [▼ 自动匹配/手动选择]            │  │
│  │    物料名称: [▼ 自动匹配/手动选择]            │  │
│  │    数量:     [▼ 自动匹配/手动选择]            │  │
│  │    单价:     [▼ 自动匹配/手动选择]            │  │
│  │                                             │  │
│  │  期初库存 列映射: ...                        │  │
│  │  出库记录 列映射: ...                        │  │
│  │                                             │  │
│  │  ── 数据预览 (入库记录) ──                   │  │
│  │  ┌──────────────────────────────────────┐   │  │
│  │  │ 物料名称 │ 数量  │ 单价  │ 进货日期  │   │  │
│  │  │ ...      │ ...   │ ...   │ ...       │   │  │
│  │  └──────────────────────────────────────┘   │  │
│  │  共 XX 行 | 物料种类: XX                    │  │
│  │  ⚠ 异常: 第3行 数量为负                      │  │
│  │  [加载更多]                                  │  │
│  │                                             │  │
│  │  [← 上一步]              [开始计算 →]        │  │
│  └─────────────────────────────────────────────┘  │
│                                                  │
└─────────────────────────────────────────────────┘
```

#### 3.3.2 交互状态管理

```python
class AppState:
    """应用状态，管理3个输入来源的文件/sheet/映射/数据"""

    sources: dict[InputSource, SourceState]

@dataclass
class SourceState:
    """单个输入来源的状态"""
    file_path: str | None = None
    sheet_name: str | None = None
    sheet_columns: list[str] = []       # sheet 原始列名
    raw_data: list[dict] = []           # sheet 原始数据
    column_mapping: dict[str, str | None] = {}  # {column_key: sheet_column_name}
    preview_data: list[dict] = []       # 映射后预览数据
    stats: dict = {}                    # 统计信息
    anomalies: list[AnomalyRecord] = [] # 异常记录
    show_all_rows: bool = False         # 是否展示全部行
```

#### 3.3.3 关键交互逻辑

| 事件 | 处理 |
|------|------|
| 点击"选择文件" | 打开文件对话框 → 读取 sheet 列表 → 填充下拉框 |
| 选择 sheet | 读取数据 → 自动匹配列名 → 更新映射下拉框 → 加载预览 |
| 修改列映射 | 重新生成预览数据 → 重新检测异常 → 刷新表格 |
| 点击"加载更多" | `show_all_rows = True` → 刷新表格展示全部数据 |
| 点击"下一步" | 校验3个来源的映射完整性 → 未完成则提示 → 完成则切换页面 |
| 点击"开始计算" | 校验映射 → 进入里程碑二（暂不可用，提示"功能开发中"） |

---

## 4. 日志规范

### 4.1 日志框架

使用 Python 标准库 `logging` 模块，不引入第三方依赖。

### 4.2 日志配置

```python
import logging
from logging.handlers import RotatingFileHandler

def setup_logger():
    logger = logging.getLogger("monthly_settlement")
    logger.setLevel(logging.DEBUG)

    # 文件输出: RotatingFileHandler, 单文件最大 5MB, 保留3个备份
    file_handler = RotatingFileHandler(
        "logs/app.log", maxBytes=5*1024*1024, backupCount=3,
        encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s.%(funcName)s:%(lineno)d - %(message)s"
    ))

    # 控制台输出: 仅 WARNING 及以上
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.WARNING)
    console_handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s"
    ))

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
```

### 4.3 日志级别使用规范

| 级别 | 使用场景 | 示例 |
|------|----------|------|
| DEBUG | 详细调试信息，开发阶段使用 | 读取到的 sheet 列名、自动匹配结果 |
| INFO | 关键业务流程节点 | 用户选择文件、选择 sheet、列映射完成 |
| WARNING | 可恢复的异常情况 | 列自动匹配失败需手动选择、数据存在异常值 |
| ERROR | 操作失败但程序可继续 | 文件读取失败、sheet 不存在 |
| CRITICAL | 程序无法继续运行 | openpyxl 未安装、必要文件损坏 |

### 4.4 里程碑一日志埋点

| 模块 | 函数 | 级别 | 日志内容 |
|------|------|------|----------|
| excel_handler | get_sheet_names | INFO | 读取文件 {file_path} 的 sheet 列表: {sheets} |
| excel_handler | get_sheet_names | ERROR | 读取文件失败: {file_path}, 原因: {error} |
| excel_handler | read_sheet | INFO | 读取 sheet: {sheet_name}, 行数: {row_count} |
| excel_handler | read_sheet | ERROR | 读取 sheet 失败: {sheet_name}, 原因: {error} |
| ColumnMapper | auto_match | DEBUG | 自动匹配结果: {mapping} |
| ColumnMapper | auto_match | WARNING | 列 {column_key} 自动匹配失败，需手动选择 |
| DataAnalyzer | detect_anomalies | WARNING | 检测到 {count} 条异常数据 |
| main | on_file_selected | INFO | 用户选择文件: {source} -> {file_path} |
| main | on_sheet_selected | INFO | 用户选择 sheet: {source} -> {sheet_name} |
| main | on_mapping_changed | INFO | 用户修改列映射: {source} -> {mapping} |
| main | on_next_step | INFO | 用户进入下一步 |
| main | on_next_step | WARNING | 列映射不完整，无法进入下一步: {missing} |

---

## 5. 测试规范

### 5.1 测试框架

使用 `pytest` 作为测试框架，配合 `pytest-cov` 进行覆盖率统计。

### 5.2 测试目录结构

```
tests/
├── __init__.py
├── conftest.py              # 公共 fixtures
├── test_excel_handler.py    # ExcelHandler & ColumnMapper & DataAnalyzer 测试
└── test_config.py           # 配置正确性测试
```

### 5.3 测试分类

| 类型 | 范围 | 标记 | 运行命令 |
|------|------|------|----------|
| 单元测试 | 纯逻辑函数（列匹配、异常检测、统计） | `@pytest.mark.unit` | `pytest -m unit` |
| 集成测试 | 涉及文件 I/O 的操作（读取 xlsx） | `@pytest.mark.integration` | `pytest -m integration` |

### 5.4 公共 Fixtures (conftest.py)

```python
@pytest.fixture
def sample_xlsx(tmp_path):
    """创建一个包含测试数据的 xlsx 文件，返回文件路径"""
    # 生成包含 入库/期初/出库 3个 sheet 的测试文件

@pytest.fixture
def inbound_columns():
    """返回入库记录的典型列名列表"""

@pytest.fixture
def sample_mapping():
    """返回一个完整的列映射字典"""
```

### 5.5 测试用例清单

#### 5.5.1 config.py 测试

| ID | 测试内容 | 预期结果 |
|----|----------|----------|
| CFG-001 | 每个来源的 required 列都有 aliases | 所有 required 列 aliases 非空 |
| CFG-002 | 不同来源的 column key 不重复 | key 集合无交集 |
| CFG-003 | PREVIEW_DEFAULT_ROWS 为正整数 | 值 > 0 |

#### 5.5.2 ExcelHandler 测试

| ID | 测试内容 | 预期结果 |
|----|----------|----------|
| XH-001 | 读取有效 xlsx 的 sheet 列表 | 返回正确的 sheet 名称列表 |
| XH-002 | 读取不存在的文件 | 抛出 FileNotFoundError，日志记录 ERROR |
| XH-003 | 读取指定 sheet 的数据 | 返回正确的列名和数据行 |
| XH-004 | 读取不存在的 sheet | 抛出 ValueError，日志记录 ERROR |
| XH-005 | 读取空 sheet | 返回空列名列表和空数据列表 |
| XH-006 | 数据行值类型正确 | 数值为 float/int，字符串为 str，空值为 None |

#### 5.5.3 ColumnMapper 测试

| ID | 测试内容 | 预期结果 |
|----|----------|----------|
| CM-001 | 精确匹配标准列名 | 所有列自动匹配成功 |
| CM-002 | 匹配别名 | 使用别名时也能匹配 |
| CM-003 | 部分列无法匹配 | 未匹配列返回 None，日志 WARNING |
| CM-004 | 完全无法匹配 | 所有列返回 None |
| CM-005 | 列名有多余空格 | 精确匹配失败（不自动 trim），返回 None |
| CM-006 | validate_mapping 全部映射 | 返回空列表 |
| CM-007 | validate_mapping 缺少必需列 | 返回缺少的列名列表 |

#### 5.5.4 DataAnalyzer 测试

| ID | 测试内容 | 预期结果 |
|----|----------|----------|
| DA-001 | 预览默认行数 | 返回前20行 |
| DA-002 | 数据不足20行 | 返回全部行 |
| DA-003 | 预览仅包含已映射列 | 不包含未映射列 |
| DA-004 | 统计总行数 | 与数据行数一致 |
| DA-005 | 统计物料种类数 | 去重后数量正确 |
| DA-006 | 检测数量为负 | 返回对应异常记录 |
| DA-007 | 检测日期为空 | 返回对应异常记录 |
| DA-008 | 检测单价为0 | 返回对应异常记录 |
| DA-009 | 无异常数据 | 返回空列表 |
| DA-010 | 多种异常同时存在 | 全部检测到 |

### 5.6 覆盖率要求

- 里程碑一核心逻辑（excel_handler.py, config.py）行覆盖率 **≥ 85%**
- GUI 代码（main.py）不做覆盖率要求，通过手工测试验证
- 运行命令：`pytest --cov=src --cov-report=term-missing`

### 5.7 运行脚本

```bash
# 运行全部测试
pytest tests/ -v

# 仅运行单元测试
pytest tests/ -v -m unit

# 仅运行集成测试
pytest tests/ -v -m integration

# 运行测试并生成覆盖率报告
pytest tests/ -v --cov=src --cov-report=term-missing
```

---

## 6. 依赖管理

### requirements.txt

```
openpyxl>=3.1.0
pytest>=7.0.0
pytest-cov>=4.0.0
```

### run.bat

```bat
@echo off
cd /d "%~dp0"
python -m src.main
pause
```

---

## 7. 里程碑一验收检查清单

- [ ] 能选择 xlsx 文件并展示所有 sheet 名称
- [ ] 能为3个输入来源分别指定 sheet
- [ ] 能自动匹配列名，支持手动调整
- [ ] 能预览映射后的数据（前20行）
- [ ] 点击"加载更多"可展示全部数据
- [ ] 忽略未映射的额外列
- [ ] 标注异常数据（数量为负、日期为空、单价为0）
- [ ] 显示总行数、物料种类数
- [ ] 日志正常输出到 `logs/app.log`
- [ ] 单元测试全部通过，覆盖率 ≥ 85%
