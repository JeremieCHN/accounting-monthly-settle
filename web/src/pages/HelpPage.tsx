import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Calculator, AlertCircle, FileSpreadsheet, Settings, Eye, Download, ArrowRight, Info } from 'lucide-react';

export default function HelpPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部标题栏 */}
      <header className="bg-slate-800 text-white px-6 py-3 flex items-center gap-3 shadow-md">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <h1 className="text-lg font-semibold tracking-wide">帮助中心</h1>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        {/* 操作指引 */}
        <section className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-800">操作指引</h2>
          </div>
          <div className="p-5 space-y-6">
            <p className="text-sm text-slate-600">
              本工具用于餐饮企业月度物料汇算，基于 FIFO（先入先出法）计算期末库存和出库成本。以下是完整的操作流程：
            </p>

            {/* 步骤 */}
            <div className="space-y-4">
              <Step
                num={1}
                title="上传入库记录"
                icon={<FileSpreadsheet className="w-4 h-4" />}
                description="切换到「入库记录」标签页，上传包含入库流水的 Excel 文件。入库记录需包含：进货日期、物料名称、数量、单价。"
                tips={['支持 .xlsx 和 .xls 格式', '入库数量为负表示退货', '同一文件可包含多个 Sheet，需手动选择']}
              />
              <Step
                num={2}
                title="上传期初库存"
                icon={<FileSpreadsheet className="w-4 h-4" />}
                description="切换到「期初库存」标签页，上传包含本月期初结存的 Excel 文件。期初库存需包含：物料名称、数量、单价。"
                tips={['每种物料期初仅一条记录', '如无期初数据，仍需上传文件（可为空表）']}
              />
              <Step
                num={3}
                title="上传出库记录"
                icon={<FileSpreadsheet className="w-4 h-4" />}
                description="切换到「出库记录」标签页，上传包含本月出库汇总的 Excel 文件。出库记录需包含：物料名称、数量。"
                tips={['出库记录不需要日期和单价', '同一物料多行出库会自动汇总']}
              />
              <Step
                num={4}
                title="选择 Sheet 与列映射"
                icon={<Settings className="w-4 h-4" />}
                description="每个来源上传文件后，需选择对应的 Sheet 页，工具会自动匹配列名。若自动匹配失败，请手动选择对应列。"
                tips={[
                  '自动匹配支持常见列名别名（如"物料名称"、"物料"、"品名"）',
                  '绿色高亮表示已自动匹配成功',
                  '可设置标题行号和末尾行号，跳过非数据行',
                ]}
              />
              <Step
                num={5}
                title="预览数据"
                icon={<Eye className="w-4 h-4" />}
                description="列映射完成后，下方数据预览表格会展示映射后的数据。红色底色行表示异常数据，请检查确认。"
                tips={[
                  '异常类型包括：数量为负、日期为空、单价为 0',
                  '异常行不会阻止计算，但建议核实数据',
                ]}
              />
              <Step
                num={6}
                title="开始计算"
                icon={<Calculator className="w-4 h-4" />}
                description="确认三个来源的数据无误后，点击右上角「开始计算」按钮，工具将自动执行 FIFO 计算。"
                tips={['计算前会校验文件、Sheet 和列映射是否完整', '校验不通过会弹出提示']}
              />
              <Step
                num={7}
                title="查看结果与导出"
                icon={<Download className="w-4 h-4" />}
                description="计算完成后自动跳转到「计算结果」标签页，可查看期末库存表、出库成本表和批次明细，点击导出按钮下载 xlsx 文件。"
                tips={[
                  '黄色高亮行表示该物料存在警告（如出库超库存）',
                  '批次明细可查看每种物料的 FIFO 消耗过程',
                  '导出文件包含「期末库存」和「出库成本」两个 Sheet',
                ]}
              />
            </div>
          </div>
        </section>

        {/* 计算规则说明 */}
        <section className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-800">计算规则说明</h2>
          </div>
          <div className="p-5 space-y-6">
            {/* FIFO 原理 */}
            <RuleBlock
              title="FIFO 先入先出法"
              description="FIFO（First In, First Out）是一种存货计价方法，假设最先入库的物料最先被消耗。出库时从最早的批次开始扣减，直到满足出库数量。"
            />

            {/* 批次构建 */}
            <RuleBlock title="批次构建顺序">
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-600">
                <li>
                  <strong>期初库存</strong>作为第一个批次入队（每种物料一条）
                </li>
                <li>
                  <strong>入库记录</strong>按以下顺序逐条入队：
                  <ul className="list-disc list-inside ml-5 mt-1 space-y-1 text-slate-500">
                    <li>进货日期升序（早的在前）</li>
                    <li>同日按 Excel 行号升序</li>
                    <li>日期为空的记录排最后</li>
                  </ul>
                </li>
              </ol>
            </RuleBlock>

            {/* 退货处理 */}
            <RuleBlock title="退货处理">
              <p className="text-sm text-slate-600">
                当入库数量为负数时，视为退货，从批次队列<strong>队尾</strong>开始扣减最近入库的批次。若退货数量超过可用库存，记录警告并继续处理。
              </p>
            </RuleBlock>

            {/* 出库消耗 */}
            <RuleBlock title="出库消耗">
              <p className="text-sm text-slate-600">
                出库从批次队列<strong>队首</strong>开始消耗。先消耗最早入库的批次，若该批次数量不足，则继续消耗下一个批次，直到满足出库数量。
              </p>
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700">
                  若出库数量超过可用库存，不足部分单价记为 0，并记录警告。计算仍会继续，结果中该物料行会标黄提示。
                </p>
              </div>
            </RuleBlock>

            {/* 期末库存 */}
            <RuleBlock title="期末库存计算">
              <div className="text-sm text-slate-600 space-y-1.5">
                <p>出库消耗后，批次队列中剩余的批次即为期末库存：</p>
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3 font-mono text-xs space-y-1">
                  <p>期末数量 = 剩余批次数量之和</p>
                  <p>期末金额 = Σ(剩余批次数量 × 批次单价)</p>
                  <p>加权平均单价 = 期末金额 / 期末数量</p>
                </div>
              </div>
            </RuleBlock>

            {/* 出库成本 */}
            <RuleBlock title="出库成本计算">
              <div className="text-sm text-slate-600 space-y-1.5">
                <p>出库消耗的批次构成出库成本：</p>
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3 font-mono text-xs space-y-1">
                  <p>出库数量 = 出库记录中该物料的数量合计</p>
                  <p>出库金额 = Σ(消耗批次数量 × 批次单价)</p>
                  <p>加权平均单价 = 出库金额 / 出库数量</p>
                </div>
              </div>
            </RuleBlock>

            {/* 数值精度 */}
            <RuleBlock title="数值精度">
              <p className="text-sm text-slate-600">
                所有金额和单价保留 <strong>2 位小数</strong>（四舍五入）。加权平均单价 = 总金额 / 总数量（数量 &gt; 0 时），否则为 0。
              </p>
            </RuleBlock>

            {/* 列映射规则 */}
            <RuleBlock title="列映射规则">
              <div className="text-sm text-slate-600 space-y-2">
                <p>工具会自动匹配 Excel 列名到对应字段，匹配规则为精确匹配预定义的别名：</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-slate-200 rounded-md overflow-hidden">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">来源</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">字段</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">自动匹配别名</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td className="px-3 py-1.5 border-b border-slate-100" rowSpan={4}>入库记录</td><td className="px-3 py-1.5 border-b border-slate-100">进货日期</td><td className="px-3 py-1.5 border-b border-slate-100 text-slate-500">进货日期、日期、入库日期</td></tr>
                      <tr><td className="px-3 py-1.5 border-b border-slate-100">物料名称</td><td className="px-3 py-1.5 border-b border-slate-100 text-slate-500">物料名称、物料、品名</td></tr>
                      <tr><td className="px-3 py-1.5 border-b border-slate-100">数量</td><td className="px-3 py-1.5 border-b border-slate-100 text-slate-500">数量、入库数量</td></tr>
                      <tr><td className="px-3 py-1.5 border-b border-slate-100">单价</td><td className="px-3 py-1.5 border-b border-slate-100 text-slate-500">单价、入库单价</td></tr>
                      <tr><td className="px-3 py-1.5 border-b border-slate-100" rowSpan={3}>期初库存</td><td className="px-3 py-1.5 border-b border-slate-100">物料名称</td><td className="px-3 py-1.5 border-b border-slate-100 text-slate-500">物料名称、物料、品名</td></tr>
                      <tr><td className="px-3 py-1.5 border-b border-slate-100">数量</td><td className="px-3 py-1.5 border-b border-slate-100 text-slate-500">数量、期初数量</td></tr>
                      <tr><td className="px-3 py-1.5 border-b border-slate-100">单价</td><td className="px-3 py-1.5 border-b border-slate-100 text-slate-500">单价、期初单价</td></tr>
                      <tr><td className="px-3 py-1.5" rowSpan={2}>出库记录</td><td className="px-3 py-1.5">物料名称</td><td className="px-3 py-1.5 text-slate-500">物料名称、物料、品名</td></tr>
                      <tr><td className="px-3 py-1.5">数量</td><td className="px-3 py-1.5 text-slate-500">数量、出库数量</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </RuleBlock>

            {/* 异常检测 */}
            <RuleBlock title="异常检测规则">
              <div className="text-sm text-slate-600 space-y-2">
                <p>数据预览中，以下情况会被标记为异常（红色底色高亮）：</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-slate-200 rounded-md overflow-hidden">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">异常类型</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">检测条件</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">适用来源</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-1.5 border-b border-slate-100">数量为负</td>
                        <td className="px-3 py-1.5 border-b border-slate-100">数量列值 &lt; 0</td>
                        <td className="px-3 py-1.5 border-b border-slate-100">入库记录、期初库存、出库记录</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1.5 border-b border-slate-100">日期为空</td>
                        <td className="px-3 py-1.5 border-b border-slate-100">进货日期列为空</td>
                        <td className="px-3 py-1.5 border-b border-slate-100">入库记录</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1.5">单价为 0</td>
                        <td className="px-3 py-1.5">单价列值 = 0</td>
                        <td className="px-3 py-1.5">入库记录、期初库存</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </RuleBlock>
          </div>
        </section>

        {/* 常见问题 */}
        <section className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Info className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-800">常见问题</h2>
          </div>
          <div className="p-5 space-y-4">
            <FAQ
              q="三个来源可以使用同一个 Excel 文件吗？"
              a="可以。如果入库、期初、出库数据在同一个文件的不同 Sheet 中，上传同一文件后分别选择对应的 Sheet 即可。"
            />
            <FAQ
              q="列名自动匹配不上怎么办？"
              a="自动匹配仅支持预定义的别名。如果您的 Excel 列名不在别名列表中，请手动从下拉框中选择对应的列。"
            />
            <FAQ
              q="没有期初库存数据怎么处理？"
              a="仍需上传一个文件（可以是空表或只含表头的文件），选择 Sheet 后列映射可以留空，工具会自动处理。"
            />
            <FAQ
              q="出库数量超过库存会怎样？"
              a="工具会按实际可用库存计算，不足部分单价记为 0，并在结果中标记警告（黄色高亮）。建议核实数据。"
            />
            <FAQ
              q="退货怎么处理？"
              a="在入库记录中，数量为负的行视为退货。退货会从最近入库的批次（队尾）开始扣减。"
            />
            <FAQ
              q="数据安全吗？"
              a="所有计算均在浏览器本地完成，不会上传到任何服务器。关闭页面后数据即消失。"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

/** 操作步骤组件 */
function Step({ num, title, icon, description, tips }: {
  num: number;
  title: string;
  icon: React.ReactNode;
  description: string;
  tips?: string[];
}) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">
        {num}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          {icon}
          {title}
        </h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
        {tips && tips.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {tips.map((tip, i) => (
              <li key={i} className="text-xs text-slate-400 flex items-start gap-1">
                <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
                {tip}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** 规则说明块 */
function RuleBlock({ title, description, children }: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border border-slate-200 rounded-md p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-2">{title}</h3>
      {description && <p className="text-sm text-slate-600">{description}</p>}
      {children}
    </div>
  );
}

/** 常见问题 */
function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <h4 className="text-sm font-medium text-slate-800">Q: {q}</h4>
      <p className="mt-0.5 text-sm text-slate-500 pl-4">A: {a}</p>
    </div>
  );
}
