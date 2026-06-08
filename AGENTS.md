# AGENTS.md — 月度汇算小工具

本文件供 Trae AI Agent 读取，用于理解项目上下文和开发规范。

## 项目简介

餐饮企业月度物料汇算工具，基于 FIFO（先入先出法）计算期末库存和出库成本。用户选择 Excel 文件中的 sheet 作为输入，工具自动计算并将结果导出为新的 xlsx 文件。

目标用户：财务/仓管人员。

## 技术栈

- **语言**: Python 3.14
- **GUI**: tkinter（内置，不使用第三方 GUI 框架）
- **Excel 读写**: openpyxl
- **测试**: pytest + pytest-cov
- **打包**: PyInstaller（单文件 exe，无控制台窗口）

## 项目结构

```
月度汇算/
├── src/
│   ├── __init__.py
│   ├── main.py              # 主程序入口 & tkinter GUI 界面
│   ├── config.py            # 常量定义、列映射配置、异常检测规则
│   ├── excel_handler.py     # Excel 读写（ExcelHandler）、列映射（ColumnMapper）、
│   │                        # 数据分析（DataAnalyzer）、结果导出（ExcelExporter）
│   └── fifo_engine.py       # FIFO 计算引擎（Batch/MaterialResult/CalcResult 数据结构）
├── tests/
│   ├── conftest.py          # 公共 fixtures
│   ├── test_config.py       # 配置正确性测试
│   ├── test_excel_handler.py # Excel 读写/列映射/数据分析/导出测试
│   └── test_fifo_engine.py  # FIFO 引擎测试
├── docs/
│   ├── PRD.md               # 产品需求文档
│   ├── TDD-1.md             # 技术设计文档（里程碑一：文件选择与数据预览）
│   └── TDD-2.md             # 技术设计文档（里程碑二：FIFO 计算与输出）
├── logs/                    # 日志输出目录（app.log，RotatingFileHandler，5MB×3）
├── build/                   # PyInstaller 构建临时文件
├── dist/                    # 打包输出（月度汇算.exe）
├── requirements.txt         # 依赖：openpyxl, pytest, pytest-cov
├── pytest.ini               # pytest 配置（unit/integration markers）
├── 月度汇算.spec             # PyInstaller spec 文件
├── run.bat                  # 开发运行：python -m src.main
├── build.bat                # 打包脚本
└── 汇算示例表.xlsx           # 示例数据
```

## 核心模块职责

### config.py
- `InputSource` 枚举：INBOUND（入库记录）、OPENING（期初库存）、OUTBOUND（出库记录）
- `ColumnDef` 数据类：列定义（key/display/required/aliases）
- `SOURCE_COLUMNS`：每个输入来源的必需列定义及自动匹配别名
- `ANOMALY_RULES`：异常检测规则（数量为负、日期为空、单价为0）

### excel_handler.py
- `ExcelHandler`：读取 xlsx 文件，获取 sheet 列表，读取 sheet 数据（支持跳过标题行/汇总行）
- `ColumnMapper`：列名自动匹配（精确匹配 aliases）与映射校验
- `DataAnalyzer`：数据预览、统计信息、异常检测
- `ExcelExporter`：将 CalcResult 导出为 xlsx（期末库存 + 出库成本 两个 sheet）
- `col_letter()`：列索引转字母（0→A, 25→Z, 26→AA）

### fifo_engine.py
- `Batch`：入库批次（quantity/unit_price/source_type/source_date/original_qty/consumed_qty）
- `MaterialResult`：单种物料计算结果（期末库存、出库成本、批次明细、警告）
- `CalcResult`：全部物料计算结果
- `FIFOEngine`：FIFO 计算引擎
  - 期初库存作为第一个批次入队
  - 入库记录按（日期升序，行号升序）入队，数量为负视为退货从队尾扣减
  - 出库从队首消耗，出库超过库存时记录警告
  - 期末库存 = 剩余批次加权平均，出库成本 = 消耗批次加权平均

### main.py
- `MonthlySettlementApp`：tkinter 单窗口应用，4 个 tab（入库记录、期初库存、出库记录、计算结果）
- `AppState` / `SourceState`：应用状态管理
- 每个 tab：文件选择 → sheet 选择 → 行范围设置 → 列映射 → 数据预览
- 入库 tab 计算后显示批次明细（物料选择 + 批次表格 + 汇总）
- 计算结果 tab：期末库存表 + 出库成本表 + 导出按钮

## 开发规范

### 运行命令

```bash
# 运行应用
python -m src.main

# 运行全部测试
pytest tests/ -v

# 运行测试并生成覆盖率报告
pytest tests/ -v --cov=src --cov-report=term-missing

# 仅运行单元测试
pytest tests/ -v -m unit

# 仅运行集成测试
pytest tests/ -v -m integration

# 打包为 exe
build.bat
```

### 日志规范

- 使用 Python 标准 `logging` 模块，logger 名称：`monthly_settlement`
- 日志输出到 `logs/app.log`（RotatingFileHandler，5MB，3 个备份）和控制台（WARNING 及以上）
- 日志格式：`%(asctime)s [%(levelname)s] %(name)s.%(funcName)s:%(lineno)d - %(message)s`
- 级别使用：DEBUG（调试信息）、INFO（关键业务节点）、WARNING（可恢复异常）、ERROR（操作失败）

### 数值精度

- 所有金额和单价使用 `float`
- 最终输出保留 **2 位小数**（四舍五入）
- 加权平均单价 = 总金额 / 总数量（数量 > 0 时），否则为 0

### 测试要求

- 核心逻辑（excel_handler.py, fifo_engine.py）行覆盖率 >= 85%
- GUI 代码（main.py）不做覆盖率要求，通过手工测试验证
- 测试标记：`@pytest.mark.unit`（单元测试）、`@pytest.mark.integration`（集成测试）

### 代码风格

- 使用 dataclass 定义数据结构
- 类型注解：使用 Python 3.10+ 语法（`str | None` 而非 `Optional[str]`）
- 中文注释和文档字符串
- 模块间通过数据类传递数据，避免字典嵌套过深

## 关键业务规则

1. **FIFO 排序**：期初优先 → 入库按日期升序 → 同日按行号升序 → 日期为空排最后
2. **退货处理**：入库数量为负时从队尾扣减最近批次
3. **出库超库存**：按实际库存计算，不足部分单价记为 0，记录警告
4. **列映射**：自动匹配 aliases 中的精确名称，匹配失败需手动选择
5. **异常检测**：数量为负（全部来源）、日期为空（入库）、单价为 0（入库+期初）
6. **行范围**：支持设置标题行号和末尾行号，跳过标题前行和汇总尾行

## 已知边界情况

- 同一物料同日多笔入库：按 Excel 行顺序入队
- 期初库存中无某物料：从入库记录开始建队
- 出库记录中无某物料：出库数量为 0，期末 = 期初 + 入库
- 退货数量超过可用库存：记录警告，继续处理
- 导出路径不存在：自动创建目录
