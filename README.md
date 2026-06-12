# 月度汇算 - FIFO 物料成本核算工具

餐饮企业月度物料汇算工具，基于 FIFO（先入先出法）计算期末库存和出库成本。纯前端实现，无需后端服务。

**在线使用**：[https://jeremiechn.github.io/accounting-monthly-settle/](https://jeremiechn.github.io/accounting-monthly-settle/)

## 功能

- 上传 Excel 文件，选择 Sheet 并映射列
- 自动检测异常数据（数量为负、日期为空、单价为 0）
- FIFO 引擎计算期末库存和出库成本
- 导出结果为 xlsx 文件

## 技术栈

React 18 + TypeScript + Vite + Tailwind CSS + Zustand + SheetJS
