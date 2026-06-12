import { useAppStore } from '@/store/useAppStore';
import { exportResult } from '@/utils/excelExporter';
import { Download } from 'lucide-react';

function fmt(n: number): string {
  return n.toFixed(2);
}

export default function ResultTables() {
  const { calcResult } = useAppStore();

  if (!calcResult || calcResult.materials.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-slate-400">
        请完成数据配置后执行计算
      </div>
    );
  }

  const { materials } = calcResult;

  // 期末库存合计
  const totalClosingQty = materials.reduce((s, m) => s + m.closingQuantity, 0);
  const totalClosingAmount = materials.reduce((s, m) => s + m.closingAmount, 0);

  // 出库成本合计
  const totalOutboundQty = materials.reduce((s, m) => s + m.outboundQuantity, 0);
  const totalOutboundAmount = materials.reduce((s, m) => s + m.outboundAmount, 0);

  const warningMaterials = new Set(
    materials.filter((m) => m.warnings.length > 0).map((m) => m.materialName),
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => exportResult(calcResult)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          导出结果
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* 期末库存表 */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <h3 className="px-4 py-2.5 text-sm font-semibold text-white bg-slate-700">期末库存</h3>
          <div className="overflow-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-100 text-slate-600">
                  <th className="px-3 py-2 text-left font-medium">物料名称</th>
                  <th className="px-3 py-2 text-right font-medium">数量</th>
                  <th className="px-3 py-2 text-right font-medium">单价</th>
                  <th className="px-3 py-2 text-right font-medium">金额</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr
                    key={m.materialName}
                    className={`
                      ${warningMaterials.has(m.materialName) ? 'bg-yellow-50' : ''}
                      ${!warningMaterials.has(m.materialName) && materials.indexOf(m) % 2 === 1 ? 'bg-slate-50' : ''}
                      border-t border-slate-100
                    `}
                  >
                    <td className="px-3 py-1.5 text-slate-700">{m.materialName}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{fmt(m.closingQuantity)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{fmt(m.closingAvgPrice)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{fmt(m.closingAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-semibold text-slate-800">
                  <td className="px-3 py-2">合计</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(totalClosingQty)}</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(totalClosingAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* 出库成本表 */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <h3 className="px-4 py-2.5 text-sm font-semibold text-white bg-slate-700">出库成本</h3>
          <div className="overflow-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-100 text-slate-600">
                  <th className="px-3 py-2 text-left font-medium">物料名称</th>
                  <th className="px-3 py-2 text-right font-medium">出库数量</th>
                  <th className="px-3 py-2 text-right font-medium">单价</th>
                  <th className="px-3 py-2 text-right font-medium">出库金额</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr
                    key={m.materialName}
                    className={`
                      ${warningMaterials.has(m.materialName) ? 'bg-yellow-50' : ''}
                      ${!warningMaterials.has(m.materialName) && materials.indexOf(m) % 2 === 1 ? 'bg-slate-50' : ''}
                      border-t border-slate-100
                    `}
                  >
                    <td className="px-3 py-1.5 text-slate-700">{m.materialName}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{fmt(m.outboundQuantity)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{fmt(m.outboundAvgPrice)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{fmt(m.outboundAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-semibold text-slate-800">
                  <td className="px-3 py-2">合计</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(totalOutboundQty)}</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(totalOutboundAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
