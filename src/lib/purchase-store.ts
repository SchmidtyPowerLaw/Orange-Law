import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FiatCurrency } from "@/lib/format";
import type { PurchaseRow } from "@/lib/purchases";

type PurchaseState = {
  rows: PurchaseRow[];
  currency: FiatCurrency;
  show: boolean;
  fileName: string | null;
  setCurrency: (currency: FiatCurrency) => void;
  setShow: (show: boolean) => void;
  load: (rows: PurchaseRow[], fileName: string) => void;
  clear: () => void;
};

export const usePurchases = create<PurchaseState>()(
  persist(
    (set) => ({
      rows: [],
      currency: "CAD",
      show: true,
      fileName: null,
      setCurrency: (currency) => set({ currency }),
      setShow: (show) => set({ show }),
      load: (rows, fileName) => set({ rows, fileName, show: true }),
      clear: () => set({ rows: [], fileName: null }),
    }),
    { name: "orange-law-purchases" },
  ),
);
