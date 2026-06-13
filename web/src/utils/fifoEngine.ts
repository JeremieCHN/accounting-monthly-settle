/** 月度汇算 Web 版 - FIFO 计算引擎（从 Python fifo_engine.py 移植） */

import type { Batch, MaterialResult, CalcResult } from '@/types';

/** 四舍五入到2位小数 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** FIFO 先入先出计算引擎 */
export class FIFOEngine {
  /**
   * 执行 FIFO 计算
   * 输入数据格式: 每行为 {column_key: value} 的字典
   */
  calculate(
    openingData: Record<string, unknown>[],
    inboundData: Record<string, unknown>[],
    outboundData: Record<string, unknown>[],
  ): CalcResult {
    // 收集所有物料名称
    const allMaterials = new Set<string>();
    for (const row of openingData) {
      const name = row.material;
      if (name != null) allMaterials.add(String(name));
    }
    for (const row of inboundData) {
      const name = row.material;
      if (name != null) allMaterials.add(String(name));
    }
    for (const row of outboundData) {
      const name = row.material;
      if (name != null) allMaterials.add(String(name));
    }

    const results: MaterialResult[] = [];
    let hasWarnings = false;

    for (const materialName of Array.from(allMaterials).sort()) {
      // 1. 构建批次队列
      const [batches, batchWarnings] = this.buildBatches(materialName, openingData, inboundData);

      // 2. 汇总出库数量
      let outboundQty = 0;
      for (const row of outboundData) {
        if (String(row.material) === materialName) {
          const qty = row.quantity;
          if (typeof qty === 'number') outboundQty += qty;
        }
      }

      // 3. 消耗出库
      const [remainingBatches, cost, consumedQty, warns] = this.consumeOutbound(
        batches,
        outboundQty,
        materialName,
      );

      // 4. 计算期末库存
      const [closingQty, closingAvgPrice, closingAmount] = this.calcClosing(remainingBatches);

      // 5. 出库加权平均
      const outboundAvgPrice = consumedQty > 0 ? round2(cost / consumedQty) : 0;
      const outboundAmount = round2(cost);

      // 6. 确定物料税率（取第一个有效批次的税率，相同物料税率理当一致）
      const taxRate = this.resolveTaxRate(remainingBatches, batches);

      if (warns.length > 0 || batchWarnings.length > 0) hasWarnings = true;

      results.push({
        materialName,
        closingQuantity: round2(closingQty),
        closingAvgPrice: round2(closingAvgPrice),
        closingAmount: round2(closingAmount),
        closingTaxRate: taxRate,
        outboundQuantity: round2(consumedQty),
        outboundAvgPrice,
        outboundAmount,
        outboundTaxRate: taxRate,
        batches: remainingBatches,
        warnings: [...batchWarnings, ...warns],
      });
    }

    return { materials: results, hasWarnings };
  }

  /**
   * 确定物料的税率
   * 优先从剩余批次取，否则从原始批次取
   */
  private resolveTaxRate(remainingBatches: Batch[], originalBatches: Batch[]): number {
    // 优先从剩余批次中找有税率的
    for (const b of remainingBatches) {
      if (b.taxRate > 0) return b.taxRate;
    }
    // 再从原始批次中找
    for (const b of originalBatches) {
      if (b.taxRate > 0) return b.taxRate;
    }
    return 0;
  }

  /**
   * 为指定物料构建入库批次队列
   * 1. 期初库存作为第一个批次
   * 2. 按进货日期升序，将入库记录逐条入队
   *    - 日期为空：预填条目，货还在路上，不参与当期汇算
   *    - 数量为正：正常入库，新增批次
   *    - 数量为负（退货）：从期初中扣除，期初不足则记录非法条目警告
   */
  private buildBatches(
    materialName: string,
    openingData: Record<string, unknown>[],
    inboundData: Record<string, unknown>[],
  ): [Batch[], string[]] {
    const batches: Batch[] = [];
    const warnings: string[] = [];

    // 1a. 期初库存入队
    for (const row of openingData) {
      if (String(row.material) === materialName) {
        const qty = typeof row.quantity === 'number' ? row.quantity : 0;
        const price = typeof row.price === 'number' ? row.price : 0;
        const taxRate = typeof row.taxRate === 'number' ? row.taxRate : 0;
        batches.push({
          quantity: qty,
          unitPrice: price,
          taxRate,
          sourceType: '期初',
          sourceDate: null,
          originalQty: qty,
          consumedQty: 0,
        });
        break; // 期初库存每种物料只有一条
      }
    }

    // 1b. 入库记录按 (日期升序, 原始行号升序) 排列
    const inboundRecords: (Record<string, unknown> & { _rowIndex: number })[] = [];
    inboundData.forEach((row, idx) => {
      if (String(row.material) === materialName) {
        inboundRecords.push({ ...row, _rowIndex: idx });
      }
    });

    // 排序: 日期为空排最后
    const sortedInbound = inboundRecords.sort((a, b) => {
      const aEmpty = a.date == null || String(a.date).trim() === '';
      const bEmpty = b.date == null || String(b.date).trim() === '';
      if (aEmpty && !bEmpty) return 1;
      if (!aEmpty && bEmpty) return -1;
      const aDate = String(a.date || '');
      const bDate = String(b.date || '');
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      return a._rowIndex - b._rowIndex;
    });

    // 1c. 逐条入库
    for (const record of sortedInbound) {
      const qty = typeof record.quantity === 'number' ? record.quantity : 0;
      const price = typeof record.price === 'number' ? record.price : 0;
      const taxRate = typeof record.taxRate === 'number' ? record.taxRate : 0;
      const date = record.date;
      const dateStr = date != null && String(date).trim() !== '' ? String(date) : null;

      // 日期为空：排最后入队，仍参与当期汇算
      if (qty >= 0) {
        // 正常入库：新增批次
        batches.push({
          quantity: qty,
          unitPrice: price,
          taxRate,
          sourceType: '入库',
          sourceDate: dateStr,
          originalQty: qty,
          consumedQty: 0,
        });
      } else {
        // 退货：从期初中扣除
        const returnQty = Math.abs(qty);
        const openingBatch = batches.find(b => b.sourceType === '期初');
        if (openingBatch) {
          if (openingBatch.quantity < returnQty) {
            warnings.push(
              `物料 ${materialName} 退货数量(${returnQty})超过期初库存(${openingBatch.quantity})，为非法条目`,
            );
          } else {
            openingBatch.quantity -= returnQty;
          }
        } else {
          warnings.push(`物料 ${materialName} 无期初库存，无法处理退货数量(${returnQty})，为非法条目`);
        }
      }
    }

    return [batches, warnings];
  }

  /**
   * 从批次队列中消耗出库数量
   * 返回: [剩余批次, 出库总成本(含税), 出库总数量, 警告列表]
   */
  private consumeOutbound(
    batches: Batch[],
    outboundQty: number,
    materialName: string,
  ): [Batch[], number, number, string[]] {
    const warnings: string[] = [];
    let remaining = outboundQty;
    let cost = 0;

    while (remaining > 0 && batches.length > 0) {
      const first = batches[0];
      if (remaining <= first.quantity) {
        cost += remaining * first.unitPrice;
        first.consumedQty += remaining;
        first.quantity -= remaining;
        remaining = 0;
      } else {
        cost += first.quantity * first.unitPrice;
        first.consumedQty += first.quantity;
        remaining -= first.quantity;
        batches.shift();
      }
    }

    if (remaining > 0) {
      warnings.push(`物料 ${materialName} 出库数量超过可用库存，不足: ${remaining.toFixed(2)}`);
    }

    const consumedQty = outboundQty;
    return [batches, cost, consumedQty, warnings];
  }

  /**
   * 计算期末库存
   * 返回: [总数量, 加权平均含税单价, 含税金额]
   */
  private calcClosing(batches: Batch[]): [number, number, number] {
    const totalQty = batches.reduce((sum, b) => sum + b.quantity, 0);
    if (totalQty <= 0) return [0, 0, 0];

    const totalAmount = batches.reduce((sum, b) => sum + b.quantity * b.unitPrice, 0);
    const avgPrice = totalAmount / totalQty;

    return [totalQty, avgPrice, totalAmount];
  }
}
