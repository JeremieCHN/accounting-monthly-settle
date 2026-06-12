/** 月度汇算 Web 版 - 列名自动匹配与手动映射 */

import type { InputSource } from '@/types';
import { SOURCE_COLUMNS } from './config';

/**
 * 自动匹配: 将 sheet 列名映射到 source 的必需列
 * 返回: {column_key: matched_sheet_column_name | null}
 * 匹配规则: 精确匹配 aliases 中的任一名称
 */
export function autoMatch(
  sheetColumns: string[],
  source: InputSource,
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  const colDefs = SOURCE_COLUMNS[source];

  for (const colDef of colDefs) {
    let matched: string | null = null;
    for (const alias of colDef.aliases) {
      if (sheetColumns.includes(alias)) {
        matched = alias;
        break;
      }
    }
    mapping[colDef.key] = matched;
  }

  return mapping;
}

/**
 * 校验映射完整性
 * 返回: 未映射的必需列的 display 名称列表（空列表表示校验通过）
 */
export function validateMapping(
  mapping: Record<string, string | null>,
  source: InputSource,
): string[] {
  const missing: string[] = [];
  const colDefs = SOURCE_COLUMNS[source];
  for (const colDef of colDefs) {
    if (colDef.required && (mapping[colDef.key] == null)) {
      missing.push(colDef.display);
    }
  }
  return missing;
}
