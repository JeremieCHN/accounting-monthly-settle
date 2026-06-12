import { useCallback } from 'react';
import type { InputSource } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { readSheetData } from '@/utils/excelHandler';
import { autoMatch } from '@/utils/columnMapper';
import { preview, getStats, detectAnomalies } from '@/utils/dataAnalyzer';

interface RowRangeConfigProps {
  source: InputSource;
}

export default function RowRangeConfig({ source }: RowRangeConfigProps) {
  const { sources, setSourceState, setColumnMapping } = useAppStore();
  const src = sources[source];

  const refreshData = useCallback(async (headerRow: number, lastRow: number) => {
    if (!src.file || !src.sheetName) return;

    const skipHeaderRows = headerRow - 1;
    const result = await readSheetData(src.file, src.sheetName, skipHeaderRows);
    const skipFooterRows = lastRow > 0 ? result.totalRows - lastRow : 0;
    const finalResult = skipFooterRows > 0
      ? await readSheetData(src.file, src.sheetName, skipHeaderRows, skipFooterRows)
      : result;

    const mapping = autoMatch(finalResult.columns, source);
    const previewData = preview(finalResult.data, mapping);
    const stats = getStats(finalResult.data, mapping);
    const anomalies = detectAnomalies(finalResult.data, mapping, source, headerRow);

    setSourceState(source, {
      headerRow,
      lastRow,
      sheetColumns: finalResult.columns,
      rawData: finalResult.data,
      totalExcelRows: finalResult.totalRows,
    });
    setColumnMapping(source, mapping);
    setSourceState(source, { previewData, stats, anomalies });
  }, [src.file, src.sheetName, source, setSourceState, setColumnMapping]);

  const handleHeaderRowChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (val >= 1) refreshData(val, src.lastRow);
  }, [src.lastRow, refreshData]);

  const handleLastRowChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    const lastRow = isNaN(val) || val < 0 ? 0 : val;
    refreshData(src.headerRow, lastRow);
  }, [src.headerRow, refreshData]);

  const dataStartRow = src.headerRow + 1;
  const dataEndRow = src.lastRow > 0 ? src.lastRow : src.totalExcelRows;
  const dataRowCount = src.stats.totalRows;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-slate-700">行范围设置</h4>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500">标题行号:</label>
          <input
            type="number"
            min={1}
            value={src.headerRow}
            onChange={handleHeaderRowChange}
            className="w-16 px-2 py-1 text-sm rounded border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500">末尾行号:</label>
          <input
            type="number"
            min={0}
            value={src.lastRow || ''}
            placeholder="0=末尾"
            onChange={handleLastRowChange}
            className="w-16 px-2 py-1 text-sm rounded border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          />
        </div>
      </div>
      {dataRowCount > 0 && (
        <p className="text-xs text-slate-400">
          数据: 第{dataStartRow}~{dataEndRow}行 (共{dataRowCount}行)
        </p>
      )}
    </div>
  );
}
