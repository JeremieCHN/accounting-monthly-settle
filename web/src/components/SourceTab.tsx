import type { InputSource } from '@/types';
import FileUploader from './FileUploader';
import RowRangeConfig from './RowRangeConfig';
import ColumnMapper from './ColumnMapper';
import DataPreview from './DataPreview';
import { useAppStore } from '@/store/useAppStore';

interface SourceTabProps {
  source: InputSource;
}

export default function SourceTab({ source }: SourceTabProps) {
  const { sources } = useAppStore();
  const src = sources[source];
  const hasSheet = src.sheetName != null;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* 文件上传区 */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <FileUploader source={source} />
      </div>

      {/* 行范围 + 列映射 并排 */}
      {hasSheet && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <RowRangeConfig source={source} />
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <ColumnMapper source={source} />
          </div>
        </div>
      )}

      {/* 数据预览 */}
      {hasSheet && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex-1 min-h-0">
          <DataPreview source={source} />
        </div>
      )}
    </div>
  );
}
