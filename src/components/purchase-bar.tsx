import { useEffect, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { formatBtc, formatPrice, formatReturn, FIAT_CURRENCY_OPTIONS, type FiatCurrency } from "@/lib/format";
import { type HistoryRow } from "@/lib/history";
import { usePurchases } from "@/lib/purchase-store";
import { parsePurchaseSheet, purchaseTotals } from "@/lib/purchases";
import { cn } from "@/lib/utils";

type Props = {
  history: HistoryRow[];
  spotUsd: number;
  spotCad: number;
};

function useBuyFlash(signature: string, armed: boolean): number {
  const [id, setId] = useState(0);
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (!armed) {
      prev.current = null;
      return;
    }
    if (prev.current === signature) return;
    prev.current = signature;
    setId((n) => n + 1);
  }, [signature, armed]);
  return id;
}

export function PurchaseBar({ history, spotUsd, spotCad }: Props) {
  const rows = usePurchases((s) => s.rows);
  const currency = usePurchases((s) => s.currency);
  const show = usePurchases((s) => s.show);
  const fileName = usePurchases((s) => s.fileName);
  const setCurrency = usePurchases((s) => s.setCurrency);
  const setShow = usePurchases((s) => s.setShow);
  const load = usePurchases((s) => s.load);
  const clear = usePurchases((s) => s.clear);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const spot = currency === "CAD" ? spotCad : spotUsd;
  const totals = purchaseTotals(rows, history, currency, spot);
  const has = rows.length > 0;
  const flashId = useBuyFlash(
    `${rows.length}|${currency}|${totals.avg.toFixed(0)}|${totals.total.toFixed(3)}`,
    has,
  );

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = await parsePurchaseSheet(file);
      load(parsed, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that sheet.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-6 rounded-lg bg-raised px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Your buys
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your buy dates + dollar amounts to plot your stack.
          </p>
        </div>
        <Segmented<FiatCurrency>
          ariaLabel="Purchase sheet currency"
          value={currency}
          onChange={setCurrency}
          size="sm"
          wrap={false}
          options={FIAT_CURRENCY_OPTIONS}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id="purchase-file"
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          className="hidden"
          onChange={(ev) => void onPick(ev.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload />
          {busy ? "Reading…" : has ? "Replace sheet" : "Upload Excel"}
        </Button>
        <button
          type="button"
          role="switch"
          aria-checked={show}
          disabled={!has}
          onClick={() => setShow(!show)}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-[background-color,color] duration-150 ease-out",
            !has && "cursor-not-allowed opacity-50",
            has && show
              ? "bg-purchase/20 text-purchase"
              : "bg-muted text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "size-3 rounded-full",
              has && show ? "bg-purchase" : "bg-muted-foreground/40",
            )}
            aria-hidden
          />
          Buys {has && show ? "on" : "off"}
        </button>
        {has ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => clear()}>
            <Trash2 />
            Clear
          </Button>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-sm text-down">{error}</p> : null}

      {has ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="min-w-0 rounded-lg bg-card px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Avg buy
              </p>
              <p
                key={`avg-${flashId}`}
                className="span-flash mt-1 font-mono text-xl tabular-nums text-foreground md:text-2xl"
              >
                {formatPrice(totals.avg, currency)}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {formatBtc(totals.btc)} · cost {formatPrice(totals.amount, currency)}
              </p>
            </div>
            <div className="min-w-0 rounded-lg bg-card px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Return to date
              </p>
              <p
                key={`ret-${flashId}`}
                className={cn(
                  "span-flash span-flash-delay-1 mt-1 font-mono text-xl tabular-nums md:text-2xl",
                  totals.total >= 0 ? "text-up" : "text-down",
                )}
              >
                {formatReturn(totals.total)}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                now {formatPrice(totals.valueNow, currency)} · spot {formatPrice(spot, currency)}
              </p>
            </div>
          </div>
          {fileName ? (
            <p className="mt-2 truncate font-mono text-xs text-muted-foreground">{fileName}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
