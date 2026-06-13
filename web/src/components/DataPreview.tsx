import type { InputSource } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { SOURCE_COLUMNS } from '@/utils/config';
import AnomalyBadge from './AnomalyBadge';

interface DataPreviewProps {
  source: InputSource;
}

export default function DataPreview({ source }: DataPreviewProps) {
  const { sources } = useAppStore();
  const src = sources[source];
  const colDefs = SOURCE_COLUMNS[source];

  if (src.previewData.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-slate-400">
        请先选择文件和工作表
      </div>
    );
  }

  const anomalyRows = new Set(src.anomalies.map((a) => a.rowIndex));
  // 预填条目行（日期为空）
  const prefilledRows = new Set(
    src.anomalies.filter((a) => a.rule === 'date_empty').map((a) => a.rowIndex),
  );
  // 退货行（数量为负）
  const returnRows = new Set(
    src.anomalies.filter((a) => a.rule === 'quantity_negative').map((a) => a.rowIndex),
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-medium text-slate-700">数据预览</h4>
        {src.anomalies.length > 0 && <AnomalyBadge count={src.anomalies.length} />}
      </div>

      <div className="overflow-auto max-h-72 rounded border border-slate-200">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-700 text-white">
              <th className="px-2 py-1.5 text-left font-medium w-10">#</th>
              {colDefs.map((colDef) => (
                <th key={colDef.key} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                  {colDef.display}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {src.previewData.map((row, idx) => {
              const excelRow = src.headerRow + idx + 1;
              const isPrefilled = prefilledRows.has(excelRow);
              const isReturn = returnRows.has(excelRow);
              const isAnomaly = anomalyRows.has(excelRow) && !isPrefilled && !isReturn;

              let rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
              let rowText = 'text-slate-700';
              if (isPrefilled) {
                rowBg = 'bg-blue-50';
                rowText = 'text-blue-700';
              } else if (isReturn) {
                rowBg = 'bg-amber-50';
                rowText = 'text-amber-700';
              } else if (isAnomaly) {
                rowBg = 'bg-red-50';
                rowText = 'text-red-700';
              }

              return (
                <tr
                  key={idx}
                  className={`
                    ${rowBg}
                    ${rowText}
                  `}
                >
                  <td className="px-2 py-1 text-slate-400">{excelRow}</td>
                  {colDefs.map((colDef) => {
                    const val = row[colDef.key];
                    const isNum = typeof val === 'number';
                    return (
                      <td
                        key={colDef.key}
                        className={`px-2 py-1 whitespace-nowrap ${isNum ? 'text-right tabular-nums' : ''}`}
                      >
                        {val != null ? String(val) : ''}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          共 {src.stats.totalRows} 行 | 物料种类: {src.stats.materialCount}
        </span>
      </div>

      {src.anomalies.length > 0 && (
        <div className="text-xs space-y-1">
          {src.anomalies.slice(0, 5).map((a, i) => {
            const colorClass =
              a.rule === 'date_empty'
                ? 'text-blue-600'
                : a.rule === 'quantity_negative'
                  ? 'text-amber-600'
                  : 'text-red-600';
            return (
              <div key={i} className={`${colorClass} space-y-0.5`}>
                <p>
                  第{a.rowIndex}行 {a.column}: {a.label}
                </p>
                <p className="text-slate-500 pl-3">
                  {a.participatesCalculation ? '✓ 参与计算' : '✗ 不参与计算'} — {a.handling}
                </p>
                <p className="text-orange-600 pl-3">
                  ⚠ {a.consequence}
                </p>
              </div>
            );
          })}
          {src.anomalies.length > 5 && (
            <p className="text-slate-500">...还有 {src.anomalies.length - 5} 条标记</p>
          )}
        </div>
      )}
    </div>
  );
}
