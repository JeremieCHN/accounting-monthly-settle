/** 月度汇算 Web 版 - 结果导出为 xlsx */

import * as XLSX from 'xlsx';
import type { CalcResult } from '@/types';

/**
 * 将计算结果导出为 xlsx 文件并触发浏览器下载
 */
export function exportResult(result: CalcResult): void {
  const wb = XLSX.utils.book_new();

  // ---- Sheet 1: 期末库存 ----
  const closingData: unknown[][] = [
    ['物料名称', '数量', '单价', '金额'],
  ];
  let totalClosingQty = 0;
  let totalClosingAmount = 0;

  for (const m of result.materials) {
    closingData.push([
      m.materialName,
      Number(m.closingQuantity.toFixed(2)),
      Number(m.closingAvgPrice.toFixed(2)),
      Number(m.closingAmount.toFixed(2)),
    ]);
    totalClosingQty += m.closingQuantity;
    totalClosingAmount += m.closingAmount;
  }
  closingData.push([
    '合计',
    Number(totalClosingQty.toFixed(2)),
    '',
    Number(totalClosingAmount.toFixed(2)),
  ]);

  const wsClosing = XLSX.utils.aoa_to_sheet(closingData);
  // 设置列宽
  wsClosing['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsClosing, '期末库存');

  // ---- Sheet 2: 出库成本 ----
  const outboundData: unknown[][] = [
    ['物料名称', '出库数量', '单价', '出库金额'],
  ];
  let totalOutboundQty = 0;
  let totalOutboundAmount = 0;

  for (const m of result.materials) {
    outboundData.push([
      m.materialName,
      Number(m.outboundQuantity.toFixed(2)),
      Number(m.outboundAvgPrice.toFixed(2)),
      Number(m.outboundAmount.toFixed(2)),
    ]);
    totalOutboundQty += m.outboundQuantity;
    totalOutboundAmount += m.outboundAmount;
  }
  outboundData.push([
    '合计',
    Number(totalOutboundQty.toFixed(2)),
    '',
    Number(totalOutboundAmount.toFixed(2)),
  ]);

  const wsOutbound = XLSX.utils.aoa_to_sheet(outboundData);
  wsOutbound['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsOutbound, '出库成本');

  // 生成并下载
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const fileName = `汇算结果_${dateStr}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
