import { useAppStore } from '@/store/useAppStore';

function fmt(n: number): string {
  return n.toFixed(2);
}

export default function BatchDetail() {
  const { calcResult, selectedBatchMaterial, setSelectedBatchMaterial } = useAppStore();

  if (!calcResult || calcResult.materials.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-slate-400">
        请先执行计算
      </div>
    );
  }

  const materialNames = calcResult.materials.map((m) => m.materialName);
  const selected = selectedBatchMaterial ?? materialNames[0] ?? '';
  const material = calcResult.materials.find((m) => m.materialName === selected);

  const totalConsumed = material
    ? material.batches.reduce((s, b) => s + b.consumedQty, 0)
    : 0;
  const totalCost = material
    ? material.batches.reduce((s, b) => s + b.consumedQty * b.unitPrice, 0)
    : 0;
  const totalRemaining = material
    ? material.batches.reduce((s, b) => s + b.quantity, 0)
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-600 shrink-0">选择物料:</label>
        <select
          value={selected}
          onChange={(e) => setSelectedBatchMaterial(e.target.value)}
          className="flex-1 px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
        >
          {materialNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {material && (
        <>
          <div className="overflow-auto max-h-72 rounded border border-slate-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-700 text-white">
                  <th className="px-2 py-1.5 text-left font-medium">来源</th>
                  <th className="px-2 py-1.5 text-left font-medium">日期</th>
                  <th className="px-2 py-1.5 text-right font-medium">原始数量</th>
                  <th className="px-2 py-1.5 text-right font-medium">消耗数量</th>
                  <th className="px-2 py-1.5 text-right font-medium">剩余数量</th>
                  <th className="px-2 py-1.5 text-right font-medium">含税单价</th>
                  <th className="px-2 py-1.5 text-right font-medium">税率</th>
                </tr>
              </thead>
              <tbody>
                {material.batches.map((batch, idx) => {
                  const isFullyConsumed = batch.consumedQty > 0 && batch.quantity === 0;
                  return (
                    <tr
                      key={idx}
                      className={`
                        ${isFullyConsumed ? 'text-slate-400' : 'text-slate-700'}
                        ${idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}
                        border-t border-slate-100
                      `}
                    >
                      <td className="px-2 py-1">{batch.sourceType}</td>
                      <td className="px-2 py-1">{batch.sourceDate ?? '-'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmt(batch.originalQty)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmt(batch.consumedQty)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmt(batch.quantity)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmt(batch.unitPrice)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{batch.taxRate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-600">
            出库合计: <span className="tabular-nums font-medium">{fmt(totalConsumed)}</span>
            {' | '}
            出库成本: <span className="tabular-nums font-medium">{fmt(totalCost)}</span>
            {' | '}
            期末结余: <span className="tabular-nums font-medium">{fmt(totalRemaining)}</span>
          </p>

          {material.warnings.length > 0 && (
            <div className="text-xs text-yellow-700 bg-yellow-50 rounded p-2 space-y-0.5">
              {material.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
