/** 月度汇算 Web 版 - 数据预览与异常检测 */

import type { InputSource, AnomalyRecord, DataStats } from '@/types';
import { SOURCE_COLUMNS, ANOMALY_RULES, ANOMALY_SOURCE_APPLICABILITY, PREVIEW_DEFAULT_ROWS } from './config';

/**
 * 返回映射后的预览数据（仅包含已映射列）
 */
export function preview(
  data: Record<string, unknown>[],
  mapping: Record<string, string | null>,
  rows: number = PREVIEW_DEFAULT_ROWS,
): Record<string, unknown>[] {
  const previewData: Record<string, unknown>[] = [];
  for (const row of data.slice(0, rows)) {
    const mappedRow: Record<string, unknown> = {};
    for (const [colKey, sheetCol] of Object.entries(mapping)) {
      if (sheetCol != null) {
        mappedRow[colKey] = row[sheetCol];
      }
    }
    previewData.push(mappedRow);
  }
  return previewData;
}

/**
 * 返回统计信息: {totalRows, materialCount}
 */
export function getStats(
  data: Record<string, unknown>[],
  mapping: Record<string, string | null>,
): DataStats {
  const totalRows = data.length;
  const materialKey = mapping.material;
  let materialCount = 0;
  if (materialKey) {
    const materials = new Set<string>();
    for (const row of data) {
      const val = row[materialKey];
      if (val != null) materials.add(String(val));
    }
    materialCount = materials.size;
  }
  return { totalRows, materialCount };
}

/**
 * 检测异常数据
 * rowOffset: 行号偏移量（跳过标题行数 + 1表头行），用于计算 Excel 行号
 */
export function detectAnomalies(
  data: Record<string, unknown>[],
  mapping: Record<string, string | null>,
  source: InputSource,
  rowOffset: number = 1,
): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = [];

  // 获取适用于当前来源的规则
  const applicableRules: Record<string, { key: string; condition: string; label: string; participatesCalculation: boolean; handling: string; consequence: string }> = {};
  for (const [ruleId, rule] of Object.entries(ANOMALY_RULES)) {
    if (ANOMALY_SOURCE_APPLICABILITY[ruleId]?.includes(source)) {
      applicableRules[ruleId] = rule;
    }
  }

  // 构建 key -> ColumnDef 的映射
  const colDefMap = new Map<string, { display: string }>();
  for (const colDef of SOURCE_COLUMNS[source]) {
    colDefMap.set(colDef.key, colDef);
  }

  for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx];
    const excelRow = rowOffset + rowIdx + 1;

    for (const [ruleId, rule] of Object.entries(applicableRules)) {
      const colKey = rule.key;
      const sheetCol = mapping[colKey];
      if (sheetCol == null) continue;
      const value = row[sheetCol];
      const condition = rule.condition;

      let isAnomaly = false;
      if (condition === '<0') {
        if (typeof value === 'number' && value < 0) isAnomaly = true;
      } else if (condition === '==0') {
        if (typeof value === 'number' && value === 0) isAnomaly = true;
      } else if (condition === 'is_empty') {
        if (value == null || (typeof value === 'string' && value.trim() === '')) isAnomaly = true;
      }

      if (isAnomaly) {
        const colDef = colDefMap.get(colKey);
        const displayName = colDef?.display ?? colKey;
        anomalies.push({
          rowIndex: excelRow,
          column: displayName,
          value,
          rule: ruleId,
          label: rule.label,
          participatesCalculation: rule.participatesCalculation,
          handling: rule.handling,
          consequence: rule.consequence,
        });
      }
    }
  }

  return anomalies;
}
