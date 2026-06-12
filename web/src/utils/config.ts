/** 月度汇算 Web 版 - 常量定义 & 列映射配置 */

import type { ColumnDef, InputSource } from '@/types';

/** 每个来源的必需列定义 */
export const SOURCE_COLUMNS: Record<InputSource, ColumnDef[]> = {
  inbound: [
    { key: 'date', display: '进货日期', required: true, aliases: ['进货日期', '日期', '入库日期'] },
    { key: 'material', display: '物料名称', required: true, aliases: ['物料名称', '物料', '品名'] },
    { key: 'quantity', display: '数量', required: true, aliases: ['数量', '入库数量'] },
    { key: 'price', display: '单价', required: true, aliases: ['单价', '入库单价'] },
  ],
  opening: [
    { key: 'material', display: '物料名称', required: true, aliases: ['物料名称', '物料', '品名'] },
    { key: 'quantity', display: '数量', required: true, aliases: ['数量', '期初数量'] },
    { key: 'price', display: '单价', required: true, aliases: ['单价', '期初单价'] },
  ],
  outbound: [
    { key: 'material', display: '物料名称', required: true, aliases: ['物料名称', '物料', '品名'] },
    { key: 'quantity', display: '数量', required: true, aliases: ['数量', '出库数量'] },
  ],
};

/** 预览默认行数 */
export const PREVIEW_DEFAULT_ROWS = 20;

/** 异常检测规则 */
export const ANOMALY_RULES: Record<string, { key: string; condition: string; label: string }> = {
  quantity_negative: { key: 'quantity', condition: '<0', label: '数量为负' },
  date_empty: { key: 'date', condition: 'is_empty', label: '日期为空' },
  price_zero: { key: 'price', condition: '==0', label: '单价为0' },
};

/** 异常规则适用的来源 */
export const ANOMALY_SOURCE_APPLICABILITY: Record<string, InputSource[]> = {
  quantity_negative: ['inbound', 'opening', 'outbound'],
  date_empty: ['inbound'],
  price_zero: ['inbound', 'opening'],
};
