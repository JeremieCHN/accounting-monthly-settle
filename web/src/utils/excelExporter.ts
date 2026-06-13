/** 月度汇算 Web 版 - 结果导出为 xlsx */

import * as XLSX from 'xlsx';
import type { CalcResult } from '@/types';

/** 不含税单价 = 含税单价 / (1 + 税率) */
function exTaxPrice(inclTaxPrice: number, taxRate: number): number {
  if (taxRate <= 0) return inclTaxPrice;
  return inclTaxPrice / (1 + taxRate);
}

/**
 * 将计算结果导出为 xlsx 文件并触发浏览器下载
 */
export function exportResult(result: CalcResult): void {
  const wb = XLSX.utils.book_new();

  // ---- Sheet 1: 期末库存 ----
  // 列头: 物料名称、数量、含税单价、税率、含税金额
  const closingData: unknown[][] = [
    ['物料名称', '数量', '含税单价', '税率', '含税金额'],
  ];
  let totalClosingQty = 0;
  let totalClosingAmount = 0;

  for (const m of result.materials) {
    closingData.push([
      m.materialName,
      Number(m.closingQuantity.toFixed(2)),
      Number(m.closingAvgPrice.toFixed(2)),
      m.closingTaxRate,
      Number(m.closingAmount.toFixed(2)),
    ]);
    totalClosingQty += m.closingQuantity;
    totalClosingAmount += m.closingAmount;
  }
  closingData.push([
    '合计',
    Number(totalClosingQty.toFixed(2)),
    '',
    '',
    Number(totalClosingAmount.toFixed(2)),
  ]);

  const wsClosing = XLSX.utils.aoa_to_sheet(closingData);
  wsClosing['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsClosing, '期末库存');

  // ---- Sheet 2: 出库成本 ----
  // 列头: 物料、数量、税率、含税单价、不含税单价
  const outboundData: unknown[][] = [
    ['物料', '数量', '税率', '含税单价', '不含税单价'],
  ];
  let totalOutboundQty = 0;

  for (const m of result.materials) {
    const exTax = exTaxPrice(m.outboundAvgPrice, m.outboundTaxRate);
    outboundData.push([
      m.materialName,
      Number(m.outboundQuantity.toFixed(2)),
      m.outboundTaxRate,
      Number(m.outboundAvgPrice.toFixed(2)),
      Number(exTax.toFixed(2)),
    ]);
    totalOutboundQty += m.outboundQuantity;
  }
  outboundData.push([
    '合计',
    Number(totalOutboundQty.toFixed(2)),
    '',
    '',
    '',
  ]);

  const wsOutbound = XLSX.utils.aoa_to_sheet(outboundData);
  wsOutbound['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsOutbound, '出库成本');

  // 生成并下载
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const fileName = `汇算结果_${dateStr}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
