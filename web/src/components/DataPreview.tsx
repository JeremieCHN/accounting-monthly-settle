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
              const isAnomaly = anomalyRows.has(excelRow);

              return (
                <tr
                  key={idx}
                  className={`
                    ${isAnomaly ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                    ${isAnomaly ? 'text-red-700' : 'text-slate-700'}
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
        <div className="text-xs text-red-600 space-y-0.5">
          {src.anomalies.slice(0, 5).map((a, i) => (
            <p key={i}>
              第{a.rowIndex}行 {a.column}: {a.label}
            </p>
          ))}
          {src.anomalies.length > 5 && (
            <p>...还有 {src.anomalies.length - 5} 条异常</p>
          )}
        </div>
      )}
    </div>
  );
}
