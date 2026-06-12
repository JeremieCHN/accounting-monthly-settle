import { useCallback } from 'react';
import { Check, X } from 'lucide-react';
import type { InputSource } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { SOURCE_COLUMNS } from '@/utils/config';
import { colLetter } from '@/utils/excelHandler';
import { preview, getStats, detectAnomalies } from '@/utils/dataAnalyzer';

interface ColumnMapperProps {
  source: InputSource;
}

export default function ColumnMapper({ source }: ColumnMapperProps) {
  const { sources, setSourceState, setColumnMapping } = useAppStore();
  const src = sources[source];
  const colDefs = SOURCE_COLUMNS[source];

  const handleMappingChange = useCallback((colKey: string, sheetCol: string | null) => {
    const newMapping = { ...src.columnMapping, [colKey]: sheetCol };
    setColumnMapping(source, newMapping);

    // 刷新预览
    const previewData = preview(src.rawData, newMapping);
    const stats = getStats(src.rawData, newMapping);
    const anomalies = detectAnomalies(src.rawData, newMapping, source, src.headerRow);
    setSourceState(source, { previewData, stats, anomalies });
  }, [src.columnMapping, src.rawData, src.headerRow, source, setColumnMapping, setSourceState]);

  // 构建 "A: 列名" 格式的选项列表
  const sheetColOptions = src.sheetColumns.map((col, idx) => {
    const letter = colLetter(idx);
    const display = col.trim() !== '' ? col : '(空)';
    return { value: col, label: `${letter}: ${display}` };
  });

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-slate-700">列映射</h4>
      <div className="space-y-1.5">
        {colDefs.map((colDef) => {
          const mapped = src.columnMapping[colDef.key];
          const isMapped = mapped != null;

          return (
            <div key={colDef.key} className="flex items-center gap-2">
              <span className="text-xs text-slate-600 w-20 shrink-0 text-right">
                {colDef.display}
                {colDef.required && <span className="text-red-500">*</span>}
              </span>
              <select
                value={mapped ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  handleMappingChange(colDef.key, val || null);
                }}
                className={`
                  flex-1 px-2 py-1 text-xs rounded border bg-white
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/30
                  ${isMapped
                    ? 'border-emerald-400 focus:border-emerald-500'
                    : 'border-red-300 focus:border-red-400'
                  }
                `}
              >
                <option value="">(未映射)</option>
                {sheetColOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {isMapped ? (
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
