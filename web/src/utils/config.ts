/** 月度汇算 Web 版 - 常量定义 & 列映射配置 */

import type { ColumnDef, InputSource } from '@/types';

/** 每个来源的必需列定义 */
export const SOURCE_COLUMNS: Record<InputSource, ColumnDef[]> = {
  inbound: [
    { key: 'date', display: '进货日期', required: true, aliases: ['进货日期', '日期', '入库日期'] },
    { key: 'material', display: '物料名称', required: true, aliases: ['物料名称', '物料', '品名'] },
    { key: 'quantity', display: '数量', required: true, aliases: ['数量', '入库数量'] },
    { key: 'price', display: '含税单价', required: true, aliases: ['含税单价', '单价', '入库单价'] },
    { key: 'taxRate', display: '税率', required: true, aliases: ['税率', '税'] },
  ],
  opening: [
    { key: 'material', display: '物料名称', required: true, aliases: ['物料名称', '物料', '品名'] },
    { key: 'quantity', display: '数量', required: true, aliases: ['数量', '期初数量'] },
    { key: 'price', display: '含税单价', required: true, aliases: ['含税单价', '单价', '期初单价'] },
    { key: 'taxRate', display: '税率', required: true, aliases: ['税率', '税'] },
  ],
  outbound: [
    { key: 'material', display: '物料名称', required: true, aliases: ['物料名称', '物料', '品名'] },
    { key: 'quantity', display: '数量', required: true, aliases: ['数量', '出库数量'] },
  ],
};

/** 预览默认行数 */
export const PREVIEW_DEFAULT_ROWS = 20;

/** 异常检测规则 */
export const ANOMALY_RULES: Record<string, {
  key: string;
  condition: string;
  label: string;
  participatesCalculation: boolean;
  handling: string;
  consequence: string;
}> = {
  quantity_negative: {
    key: 'quantity',
    condition: '<0',
    label: '退货',
    participatesCalculation: true,
    handling: '从期初库存中扣除退货数量',
    consequence: '若退货超过期初库存，则为非法条目，计算结果中会标记警告',
  },
  date_empty: {
    key: 'date',
    condition: 'is_empty',
    label: '预填条目',
    participatesCalculation: true,
    handling: '排最后入队，仍参与当期汇算',
    consequence: '该批次会被最后消耗，可能影响FIFO顺序和成本分摊',
  },
  price_zero: {
    key: 'price',
    condition: '==0',
    label: '含税单价为0',
    participatesCalculation: true,
    handling: '以0单价入队参与计算',
    consequence: '该批次成本为0，会拉低加权平均单价，导致成本失真',
  },
};

/** 异常规则适用的来源 */
export const ANOMALY_SOURCE_APPLICABILITY: Record<string, InputSource[]> = {
  quantity_negative: ['inbound', 'opening', 'outbound'],
  date_empty: ['inbound'],
  price_zero: ['inbound', 'opening'],
};
