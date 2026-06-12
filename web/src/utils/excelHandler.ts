/** 月度汇算 Web 版 - Excel 读写封装（SheetJS） */

import * as XLSX from 'xlsx';

/** 列索引转字母 (0->A, 25->Z, 26->AA) */
export function colLetter(index: number): string {
  let result = '';
  let n = index;
  while (true) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return result;
}

/** 读取文件的所有 Sheet 名称 */
export async function readFileSheetNames(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  return workbook.SheetNames;
}

/** 读取指定 Sheet 的数据 */
export async function readSheetData(
  file: File,
  sheetName: string,
  skipHeaderRows: number = 0,
  skipFooterRows: number = 0,
): Promise<{ columns: string[]; data: Record<string, unknown>[]; totalRows: number }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const ws = workbook.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet '${sheetName}' 不存在`);

  // 读取为二维数组
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  if (rawData.length === 0) {
    return { columns: [], data: [], totalRows: 0 };
  }

  // 跳过开头的标题行
  const afterSkipHeader = rawData.slice(skipHeaderRows);

  if (afterSkipHeader.length === 0) {
    return { columns: [], data: [], totalRows: skipHeaderRows };
  }

  // 第一行作为表头
  const headerRow = afterSkipHeader[0] as unknown[];
  const columns: string[] = [];
  for (let i = 0; i < headerRow.length; i++) {
    const c = headerRow[i];
    if (c != null && String(c).trim() !== '') {
      columns.push(String(c));
    } else {
      columns.push(`${colLetter(i)}列`);
    }
  }

  // 读取所有数据行
  const allData: Record<string, unknown>[] = [];
  for (let r = 1; r < afterSkipHeader.length; r++) {
    const row = afterSkipHeader[r] as unknown[];
    const rowDict: Record<string, unknown> = {};
    for (let c = 0; c < columns.length; c++) {
      rowDict[columns[c]] = row[c] ?? null;
    }
    allData.push(rowDict);
  }

  // 跳过末尾的汇总行
  const data = skipFooterRows > 0
    ? skipFooterRows < allData.length
      ? allData.slice(0, allData.length - skipFooterRows)
      : []
    : allData;

  const totalRows = skipHeaderRows + 1 + allData.length;
  return { columns, data, totalRows };
}
