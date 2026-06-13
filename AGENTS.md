# AGENTS.md — 月度汇算小工具

本文件供 Trae AI Agent 读取，用于理解项目上下文和开发规范。

## 项目简介

餐饮企业月度物料汇算工具，基于 FIFO（先入先出法）计算期末库存和出库成本。用户在浏览器中上传 Excel 文件，选择 Sheet 并映射列，工具自动计算并将结果导出为新的 xlsx 文件。纯前端实现，无需后端服务。

目标用户：财务/仓管人员。

## 技术栈

- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite
- **样式方案**：Tailwind CSS 3
- **状态管理**：Zustand
- **Excel 读写**：SheetJS (xlsx) — 纯浏览器端解析和生成 xlsx
- **图标**：lucide-react
- **后端**：无
- **数据库**：无

## 项目结构

```
月度汇算/
├── web/                          # Web 项目根目录
│   ├── src/
│   │   ├── components/
│   │   │   ├── FileUploader.tsx   # 文件上传 + Sheet 选择（拖拽上传 + 文件选择 + Sheet 下拉）
│   │   │   ├── RowRangeConfig.tsx # 行范围设置（标题行号/末尾行号）
│   │   │   ├── ColumnMapper.tsx   # 列映射配置（每个必需列的下拉映射）
│   │   │   ├── DataPreview.tsx    # 数据预览表格（异常行红底高亮）
│   │   │   ├── SourceTab.tsx      # 单个来源的完整 Tab 内容（组合上述组件）
│   │   │   ├── ResultTables.tsx   # 期末库存 + 出库成本结果表
│   │   │   ├── BatchDetail.tsx    # 批次明细（物料选择 + 批次表格 + 汇总）
│   │   │   └── AnomalyBadge.tsx   # 异常数量红色徽章
│   │   ├── utils/
│   │   │   ├── fifoEngine.ts      # FIFO 计算引擎
│   │   │   ├── excelHandler.ts    # Excel 读写封装（SheetJS）
│   │   │   ├── columnMapper.ts    # 列名自动匹配（精确匹配 aliases）
│   │   │   ├── dataAnalyzer.ts    # 数据预览与异常检测
│   │   │   ├── excelExporter.ts   # 结果导出为 xlsx（Blob + URL.createObjectURL）
│   │   │   └── config.ts          # 常量定义、列映射配置、异常规则
│   │   ├── store/
│   │   │   └── useAppStore.ts     # Zustand 全局状态管理
│   │   ├── types/
│   │   │   └── index.ts           # TypeScript 类型定义
│   │   ├── pages/
│   │   │   └── Home.tsx           # 主页面（顶部标题栏 + Tab 栏 + 内容区）
│   │   ├── App.tsx                # 主应用组件
│   │   ├── main.tsx               # 入口
│   │   └── index.css              # 全局样式
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── postcss.config.js
├── src/                           # [已废弃] 原始 Python 桌面版代码，保留作参考
│   ├── main.py
│   ├── config.py
│   ├── excel_handler.py
│   └── fifo_engine.py
├── docs/                          # 文档目录
│   ├── PRD.md                     # 原始 PRD（Python 桌面版）
│   ├── TDD-1.md                   # 技术设计文档 - 里程碑一（Python 桌面版）
│   └── TDD-2.md                   # 技术设计文档 - 里程碑二（Python 桌面版）
├── .trae/
│   └── documents/
│       ├── prd.md                 # Web 版 PRD
│       └── tech-architecture.md   # Web 版技术架构文档
├── AGENTS.md                      # 本文件
└── 汇算示例表.xlsx                 # 示例数据
```

## 核心模块职责

### config.ts
- `InputSource` 类型：`'inbound'`（入库记录）、`'opening'`（期初库存）、`'outbound'`（出库记录）
- `ColumnDef` 接口：列定义（key/display/required/aliases）
- `SOURCE_COLUMNS`：每个输入来源的必需列定义及自动匹配别名
- `ANOMALY_RULES`：异常检测规则（数量为负、日期为空、单价为0）
- `ANOMALY_SOURCE_APPLICABILITY`：规则适用来源

### fifoEngine.ts
- `FIFOEngine` 类：FIFO 计算引擎（从 Python 1:1 移植）
  - `calculate(openingData, inboundData, outboundData): CalcResult`
  - `buildBatches(materialName, openingData, inboundData): Batch[]`
  - `consumeOutbound(batches, outboundQty, materialName): [Batch[], number, number, string[]]`
  - `calcClosing(batches): [number, number, number]`
- 期初库存作为第一个批次入队
- 入库记录按（日期升序，行号升序）入队，日期为空排最后仍参与汇算，数量为负视为退货从队尾扣减
- 出库从队首消耗，出库超过库存时记录警告
- 期末库存 = 剩余批次加权平均，出库成本 = 消耗批次加权平均

### excelHandler.ts
- `colLetter(index)`：列索引转字母（0→A, 25→Z, 26→AA）
- `readFileSheetNames(file)`：读取文件 Sheet 名称列表
- `readSheetData(file, sheetName, skipHeaderRows, skipFooterRows)`：读取指定 Sheet 数据

### columnMapper.ts
- `autoMatch(sheetColumns, source)`：精确匹配 aliases
- `validateMapping(mapping, source)`：校验映射完整性

### dataAnalyzer.ts
- `preview(data, mapping, rows)`：返回映射后预览数据
- `getStats(data, mapping)`：统计总行数和物料种类数
- `detectAnomalies(data, mapping, source, rowOffset)`：检测异常数据

### excelExporter.ts
- `exportResult(result)`：使用 SheetJS 生成 xlsx 并触发浏览器下载
- 输出包含"期末库存"和"出库成本"两个 Sheet

### useAppStore.ts
- Zustand 全局状态：sources, calcResult, activeMainTab, selectedBatchMaterial
- Actions：setSourceState, setColumnMapping, setCalcResult, setActiveMainTab, setSelectedBatchMaterial, reset

### Home.tsx
- 主页面：顶部标题栏 + 计算按钮、Tab 栏（入库/期初/出库/计算结果）、内容区

## 开发规范

### 运行命令

```bash
# 进入 Web 项目目录
cd web

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# TypeScript 类型检查
npx tsc -b --noEmit

# 生产构建
npm run build

# 预览生产构建
npm run preview
```

### 数值精度

- 所有金额和单价使用 JavaScript `number`
- 最终输出保留 **2 位小数**（四舍五入，使用 `toFixed(2)` 或 `Math.round(x * 100) / 100`）
- 加权平均单价 = 总金额 / 总数量（数量 > 0 时），否则为 0

### 代码风格

- 使用 TypeScript 接口定义数据结构
- 中文注释和 UI 文本
- 模块间通过接口传递数据，避免嵌套对象过深
- React 函数组件 + Hooks
- Tailwind CSS 类名样式，不使用 CSS Modules

### UI 设计规范

- **主色调**：深蓝灰 (#1e293b)，强调色：翡翠绿 (#10b981)
- **背景**：浅灰白 (#f8fafc)，卡片式布局带微妙阴影
- **字体**：正文使用系统字体栈，数字使用等宽字体 (tabular-nums)
- **布局**：Tab 切换，表格为主的信息密度型布局
- **图标**：lucide-react

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
- 浏览器端文件下载：使用 Blob + URL.createObjectURL 触发
