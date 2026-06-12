import { useCallback } from 'react';
import { Calculator, AlertTriangle } from 'lucide-react';
import SourceTab from '@/components/SourceTab';
import ResultTables from '@/components/ResultTables';
import BatchDetail from '@/components/BatchDetail';
import { useAppStore } from '@/store/useAppStore';
import { SOURCE_LABELS } from '@/types';
import type { InputSource } from '@/types';
import { FIFOEngine } from '@/utils/fifoEngine';
import { validateMapping } from '@/utils/columnMapper';

const SOURCES: InputSource[] = ['inbound', 'opening', 'outbound'];

export default function Home() {
  const { sources, calcResult, activeMainTab, setActiveMainTab, setCalcResult, setSelectedBatchMaterial } = useAppStore();

  const handleCalculate = useCallback(() => {
    // 校验：所有来源必须选择文件和 Sheet
    const missing: string[] = [];
    for (const source of SOURCES) {
      const src = sources[source];
      if (!src.fileName) missing.push(`${SOURCE_LABELS[source]}: 未选择文件`);
      else if (!src.sheetName) missing.push(`${SOURCE_LABELS[source]}: 未选择Sheet`);
    }
    if (missing.length > 0) {
      alert('请完成以下操作:\n' + missing.join('\n'));
      return;
    }

    // 校验列映射完整性
    const missingCols: string[] = [];
    for (const source of SOURCES) {
      const src = sources[source];
      const missing = validateMapping(src.columnMapping, source);
      if (missing.length > 0) {
        missingCols.push(`${SOURCE_LABELS[source]}: 缺少列映射 ${missing.join(', ')}`);
      }
    }
    if (missingCols.length > 0) {
      alert('请完成以下列映射:\n' + missingCols.join('\n'));
      return;
    }

    // 准备映射后数据
    const getMappedData = (source: InputSource) => {
      const src = sources[source];
      const mapping: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(src.columnMapping)) {
        if (v != null) mapping[k] = v;
      }
      return src.rawData.map((row) => {
        const mappedRow: Record<string, unknown> = {};
        for (const [colKey, sheetCol] of Object.entries(mapping)) {
          if (sheetCol) mappedRow[colKey] = row[sheetCol];
        }
        return mappedRow;
      });
    };

    const openingData = getMappedData('opening');
    const inboundData = getMappedData('inbound');
    const outboundData = getMappedData('outbound');

    const engine = new FIFOEngine();
    const result = engine.calculate(openingData, inboundData, outboundData);
    setCalcResult(result);

    // 设置默认选中第一个物料
    if (result.materials.length > 0) {
      setSelectedBatchMaterial(result.materials[0].materialName);
    }

    setActiveMainTab('result');
  }, [sources, setCalcResult, setActiveMainTab, setSelectedBatchMaterial]);

  const tabs = [
    ...SOURCES.map((s) => ({ key: s, label: SOURCE_LABELS[s] })),
    { key: 'result', label: '计算结果' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部标题栏 */}
      <header className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between shadow-md">
        <h1 className="text-lg font-semibold tracking-wide">月度汇算小工具</h1>
        <button
          onClick={handleCalculate}
          className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <Calculator className="w-4 h-4" />
          开始计算
        </button>
      </header>

      {/* Tab 栏 */}
      <nav className="bg-white border-b border-slate-200 px-6">
        <div className="flex gap-0">
          {tabs.map((tab) => {
            const isActive = activeMainTab === tab.key;
            const source = tab.key as InputSource;
            const anomalyCount = SOURCES.includes(source) ? sources[source]?.anomalies?.length ?? 0 : 0;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveMainTab(tab.key)}
                className={`
                  relative px-4 py-2.5 text-sm font-medium transition-colors
                  ${isActive
                    ? 'text-emerald-700 border-b-2 border-emerald-600'
                    : 'text-slate-500 hover:text-slate-700 border-b-2 border-transparent'
                  }
                `}
              >
                {tab.label}
                {anomalyCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-600 rounded-full">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {anomalyCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* 内容区 */}
      <main className="p-6 max-w-[1400px] mx-auto">
        {SOURCES.includes(activeMainTab as InputSource) ? (
          <SourceTab source={activeMainTab as InputSource} />
        ) : activeMainTab === 'result' ? (
          <div className="space-y-6">
            <ResultTables />
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">批次明细</h3>
              <BatchDetail />
            </div>
            {calcResult?.hasWarnings && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-yellow-700 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  警告信息
                </h3>
                <div className="text-xs text-yellow-700 space-y-0.5">
                  {calcResult.materials
                    .filter((m) => m.warnings.length > 0)
                    .flatMap((m) => m.warnings)
                    .map((w, i) => (
                      <p key={i}>{w}</p>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
