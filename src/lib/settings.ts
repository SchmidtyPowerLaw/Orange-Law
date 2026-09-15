import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Currency } from "@/lib/format";
import { migrateChartRange, type ChartRange } from "@/lib/history";
import { defaultTargetIso } from "@/lib/powerlaw";
import { sanitizeAssetIds, type AssetId } from "@/lib/compare";

type SettingsState = {
  currency: Currency;
  currencyTouched: boolean;
  range: ChartRange;
  holdings: number;
  targetDate: string;
  showEvents: boolean;
  showFuture: boolean;
  compareIds: AssetId[];
  setCurrency: (currency: Currency) => void;
  applyGeoCurrency: (currency: Currency) => void;
  setRange: (range: ChartRange) => void;
  setHoldings: (holdings: number) => void;
  setTargetDate: (targetDate: string) => void;
  setShowEvents: (showEvents: boolean) => void;
  setShowFuture: (showFuture: boolean) => void;
  toggleCompare: (id: AssetId) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      currency: "USD",
      currencyTouched: false,
      range: "all",
      holdings: 1,
      targetDate: defaultTargetIso(),
      showEvents: false,
      showFuture: false,
      compareIds: [],
      setCurrency: (currency) => set({ currency, currencyTouched: true }),
      applyGeoCurrency: (currency) =>
        set((s) => (s.currencyTouched ? s : { currency })),
      setRange: (range) => set({ range }),
      setHoldings: (holdings) => set({ holdings }),
      setTargetDate: (targetDate) => set({ targetDate }),
      setShowEvents: (showEvents) => set({ showEvents }),
      setShowFuture: (showFuture) => set({ showFuture }),
      toggleCompare: (id) =>
        set((s) => ({
          compareIds: s.compareIds.includes(id)
            ? s.compareIds.filter((item) => item !== id)
            : [...s.compareIds, id],
        })),
    }),
    {
      name: "orange-law-settings",
      partialize: (s) => ({
        currency: s.currency,
        currencyTouched: s.currencyTouched,
        range: s.range,
        holdings: s.holdings,
        targetDate: s.targetDate,
        compareIds: s.compareIds,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        const currency =
          p.currency === "CAD" || p.currency === "USD" || p.currency === "XAU"
            ? p.currency
            : current.currency;
        const currencyTouched =
          p.currencyTouched === true || currency === "CAD" || currency === "XAU";
        return {
          ...current,
          ...p,
          currency,
          currencyTouched,
          range: migrateChartRange(p.range ?? current.range),
          showEvents: false,
          showFuture: false,
          compareIds: sanitizeAssetIds(p.compareIds ?? current.compareIds),
        };
      },
    },
  ),
);