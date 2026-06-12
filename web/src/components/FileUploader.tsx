import { useCallback, useState, useRef } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import type { InputSource } from '@/types';
import { SOURCE_LABELS } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { readFileSheetNames, readSheetData } from '@/utils/excelHandler';
import { autoMatch } from '@/utils/columnMapper';
import { preview, getStats, detectAnomalies } from '@/utils/dataAnalyzer';

interface FileUploaderProps {
  source: InputSource;
}

export default function FileUploader({ source }: FileUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { sources, setSourceState, setColumnMapping } = useAppStore();
  const src = sources[source];

  const label = SOURCE_LABELS[source];

  const processFile = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const sheetNames = await readFileSheetNames(file);
      setSourceState(source, {
        fileName: file.name,
        file,
        sheetNames,
        sheetName: null,
        sheetColumns: [],
        rawData: [],
        columnMapping: {},
        previewData: [],
        stats: { totalRows: 0, materialCount: 0 },
        anomalies: [],
        totalExcelRows: 0,
      });

      if (sheetNames.length === 1) {
        await selectSheet(file, sheetNames[0]);
      }
    } catch (err) {
      console.error('读取文件失败:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, setSourceState]);

  const selectSheet = useCallback(async (file: File, sheetName: string) => {
    setLoading(true);
    try {
      const headerRow = sources[source].headerRow;
      const lastRow = sources[source].lastRow;
      const skipHeaderRows = headerRow - 1;
      const result = await readSheetData(file, sheetName, skipHeaderRows);
      const skipFooterRows = lastRow > 0 ? result.totalRows - lastRow : 0;
      const finalResult = skipFooterRows > 0
        ? await readSheetData(file, sheetName, skipHeaderRows, skipFooterRows)
        : result;

      const mapping = autoMatch(finalResult.columns, source);
      const previewData = preview(finalResult.data, mapping);
      const stats = getStats(finalResult.data, mapping);
      const anomalies = detectAnomalies(finalResult.data, mapping, source, headerRow);

      setSourceState(source, {
        sheetName,
        sheetColumns: finalResult.columns,
        rawData: finalResult.data,
        totalExcelRows: finalResult.totalRows,
      });
      setColumnMapping(source, mapping);
      setSourceState(source, { previewData, stats, anomalies });
    } catch (err) {
      console.error('读取Sheet失败:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, setSourceState, setColumnMapping]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleSheetChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const sheetName = e.target.value;
    if (src.file && sheetName) {
      selectSheet(src.file, sheetName);
    }
  }, [src.file, selectSheet]);

  return (
    <div className="space-y-3">
      {!src.fileName ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            flex flex-col items-center justify-center gap-2 p-8 rounded-lg cursor-pointer
            border-2 border-dashed transition-colors
            ${dragging
              ? 'border-emerald-500 bg-emerald-50'
              : 'border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/50'
            }
          `}
        >
          <Upload className={`w-8 h-8 ${dragging ? 'text-emerald-500' : 'text-slate-400'}`} />
          <p className="text-sm text-slate-600">
            拖拽 Excel 文件到此处，或<span className="text-emerald-600 font-medium">点击选择</span>
          </p>
          <p className="text-xs text-slate-400">{label} - 支持 .xlsx 文件</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm text-slate-700 truncate flex-1">{src.fileName}</span>
          {loading && <span className="text-xs text-slate-400">加载中...</span>}
        </div>
      )}

      {src.sheetNames.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 shrink-0">工作表:</label>
          <select
            value={src.sheetName ?? ''}
            onChange={handleSheetChange}
            className="flex-1 px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          >
            <option value="" disabled>请选择工作表</option>
            {src.sheetNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
