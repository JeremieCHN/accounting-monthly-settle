# 月度汇算 Web 版

餐饮企业月度物料汇算工具，基于 FIFO（先入先出法）计算期末库存和出库成本。纯前端实现，无需后端服务。

## 功能

- 上传 Excel 文件，选择 Sheet 并自动/手动映射列名
- 支持入库记录、期初库存、出库记录三个数据来源
- 基于 FIFO 算法计算期末库存和出库成本
- 批次明细查看（物料选择 + 批次队列 + 消耗情况）
- 异常数据检测（数量为负、日期为空、单价为0）
- 结果导出为 xlsx 文件（含期末库存和出库成本两个 Sheet）

## 技术栈

- React 18 + TypeScript
- Vite
- Tailwind CSS 3
- Zustand（状态管理）
- SheetJS / xlsx（Excel 读写）
- lucide-react（图标）

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 类型检查
npx tsc -b --noEmit

# 生产构建
npm run build

# 预览生产构建
npm run preview
```

## 使用流程

1. 分别为入库记录、期初库存、出库记录上传 Excel 文件
2. 选择对应的 Sheet，设置行范围
3. 确认列映射（自动匹配 + 手动调整）
4. 预览数据确认无误
5. 点击"开始计算"
6. 查看期末库存表、出库成本表、批次明细
7. 导出结果为 xlsx 文件
