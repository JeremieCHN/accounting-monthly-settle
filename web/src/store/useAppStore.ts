/** 月度汇算 Web 版 - Zustand 全局状态 */

import { create } from 'zustand';
import type { InputSource, SourceState, CalcResult } from '@/types';
import { createDefaultSourceState } from '@/types';

interface AppStore {
  sources: Record<InputSource, SourceState>;
  calcResult: CalcResult | null;
  activeMainTab: string; // 'inbound' | 'opening' | 'outbound' | 'result'
  selectedBatchMaterial: string | null;

  setSourceState: (source: InputSource, state: Partial<SourceState>) => void;
  setColumnMapping: (source: InputSource, mapping: Record<string, string | null>) => void;
  setCalcResult: (result: CalcResult | null) => void;
  setActiveMainTab: (tab: string) => void;
  setSelectedBatchMaterial: (name: string | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  sources: {
    inbound: createDefaultSourceState(),
    opening: createDefaultSourceState(),
    outbound: createDefaultSourceState(),
  },
  calcResult: null,
  activeMainTab: 'inbound',
  selectedBatchMaterial: null,

  setSourceState: (source, state) =>
    set((s) => ({
      sources: {
        ...s.sources,
        [source]: { ...s.sources[source], ...state },
      },
    })),

  setColumnMapping: (source, mapping) =>
    set((s) => ({
      sources: {
        ...s.sources,
        [source]: { ...s.sources[source], columnMapping: mapping },
      },
    })),

  setCalcResult: (result) => set({ calcResult: result }),

  setActiveMainTab: (tab) => set({ activeMainTab: tab }),

  setSelectedBatchMaterial: (name) => set({ selectedBatchMaterial: name }),

  reset: () =>
    set({
      sources: {
        inbound: createDefaultSourceState(),
        opening: createDefaultSourceState(),
        outbound: createDefaultSourceState(),
      },
      calcResult: null,
      activeMainTab: 'inbound',
      selectedBatchMaterial: null,
    }),
}));
