/** 月度汇算 Web 版 - TypeScript 类型定义 */

/** 输入来源 */
export type InputSource = 'inbound' | 'opening' | 'outbound';

/** 输入来源显示名称映射 */
export const SOURCE_LABELS: Record<InputSource, string> = {
  inbound: '入库记录',
  opening: '期初库存',
  outbound: '出库记录',
};

/** 列定义 */
export interface ColumnDef {
  key: string;
  display: string;
  required: boolean;
  aliases: string[];
}

/** 入库批次 */
export interface Batch {
  quantity: number;
  unitPrice: number;
  sourceType: string; // "期初" | "入库"
  sourceDate: string | null;
  originalQty: number;
  consumedQty: number;
}

/** 单种物料的计算结果 */
export interface MaterialResult {
  materialName: string;
  closingQuantity: number;
  closingAvgPrice: number;
  closingAmount: number;
  outboundQuantity: number;
  outboundAvgPrice: number;
  outboundAmount: number;
  batches: Batch[];
  warnings: string[];
}

/** 全部物料的计算结果 */
export interface CalcResult {
  materials: MaterialResult[];
  hasWarnings: boolean;
}

/** 异常记录 */
export interface AnomalyRecord {
  rowIndex: number;
  column: string;
  value: unknown;
  rule: string;
  label: string;
}

/** 统计信息 */
export interface DataStats {
  totalRows: number;
  materialCount: number;
}

/** 单个来源的状态 */
export interface SourceState {
  fileName: string | null;
  file: File | null;
  sheetName: string | null;
  headerRow: number;
  lastRow: number;
  sheetColumns: string[];
  sheetNames: string[];
  rawData: Record<string, unknown>[];
  columnMapping: Record<string, string | null>;
  previewData: Record<string, unknown>[];
  stats: DataStats;
  anomalies: AnomalyRecord[];
  totalExcelRows: number;
}

/** 创建默认来源状态 */
export function createDefaultSourceState(): SourceState {
  return {
    fileName: null,
    file: null,
    sheetName: null,
    headerRow: 1,
    lastRow: 0,
    sheetColumns: [],
    sheetNames: [],
    rawData: [],
    columnMapping: {},
    previewData: [],
    stats: { totalRows: 0, materialCount: 0 },
    anomalies: [],
    totalExcelRows: 0,
  };
}
