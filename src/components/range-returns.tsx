import { useEffect, useRef, useState } from "react";
import {
  MAX_TARGET_ISO,
  PROJECTED_QUANTILES,
  annualizedReturn,
  isoFromDay,
  totalReturn,
} from "@/lib/powerlaw";
import { formatPrice, formatReturn, formatPct, type Currency } from "@/lib/format";
import { type SpanPoint, priceOf } from "@/lib/history";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  currency: Currency;
  liveXau?: number;
  liveFx?: number;
  selA: SpanPoint | null;
  selB: SpanPoint | null;
  minIso: string;
  onClear: () => void;
  onDate: (edge: "start" | "end", iso: string) => void;
};

function useSelectionFlash(selA: SpanPoint | null, selB: SpanPoint | null): number {
  const skip = useRef(true);
  const [id, setId] = useState(0);
  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    if (selA == null || selB == null) return;
    setId((n) => n + 1);
  }, [selA, selB]);
  return id;
}

function bandLabel(point: SpanPoint): string | null {
  if (!point.projected || !point.band) return null;
  return PROJECTED_QUANTILES.find((q) => q.id === point.band)?.short ?? null;
}

export function RangeReturns({
  currency,
  liveXau,
  liveFx,
  selA,
  selB,
  minIso,
  onClear,
  onDate,
}: Props) {
  const flashId = useSelectionFlash(selA, selB);
  const ready = selA != null && selB != null;
  const first = ready ? (selA.t <= selB.t ? selA : selB) : selA;
  const second = ready ? (selA.t <= selB.t ? selB : selA) : null;
  const projected = Boolean(first?.projected || second?.projected);
  const startIso = first ? isoFromDay(first.t) : "";
  const endIso = second ? isoFromDay(second.t) : "";

  const p1 = first ? priceOf(first, currency, liveXau, liveFx) : 0;
  const p2 = second ? priceOf(second, currency, liveXau, liveFx) : 0;
  const days = first && second ? second.t - first.t : 0;
  const total = first && second ? totalReturn(p1, p2) : 0;
  const cagr = first && second && days > 0 ? annualizedReturn(p1, p2, days) : null;
  const years = days / 365.25;
  const tone = projected ? "text-projection" : total >= 0 ? "text-up" : "text-down";
  const cagrTone = projected ? "text-projection" : cagr != null && cagr >= 0 ? "text-up" : "text-down";

  return (
    <div className="mt-6 rounded-lg bg-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={cn(
              "text-xs font-medium uppercase tracking-[0.16em]",
              projected ? "text-projection" : "text-muted-foreground",
            )}
          >
            {projected ? "Projected span" : "Selected span"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick two dates, or tap the chart. Future dates use the model path.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Reset
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="min-w-0">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            From{first?.projected ? ` · ${bandLabel(first)}` : ""}
          </span>
          <Input
            type="date"
            value={startIso}
            min={minIso}
            max={MAX_TARGET_ISO}
            aria-label="Span start date"
            className="mt-1.5 font-mono tabular-nums"
            onChange={(e) => {
              if (e.target.value) onDate("start", e.target.value);
            }}
          />
        </label>
        <label className="min-w-0">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            To{second?.projected ? ` · ${bandLabel(second)}` : ""}
          </span>
          <Input
            type="date"
            value={endIso}
            min={minIso}
            max={MAX_TARGET_ISO}
            aria-label="Span end date"
            className="mt-1.5 font-mono tabular-nums"
            onChange={(e) => {
              if (e.target.value) onDate("end", e.target.value);
            }}
          />
        </label>
      </div>

      {ready && first && second ? (
        <>
          <p className="mt-3 text-sm text-muted-foreground">
            {days.toLocaleString("en-CA")} days · {years.toFixed(2)} years
            {projected ? " · model path, not realized" : ""}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="min-w-0 rounded-lg bg-card px-3 py-3">
              <p className="text-xs text-muted-foreground">
                {projected ? "Projected return" : "Total return"}
              </p>
              <p
                key={`total-${flashId}`}
                className={cn(
                  "span-flash span-flash-delay-1 mt-1 font-mono text-xl tabular-nums md:text-2xl",
                  tone,
                )}
              >
                {formatReturn(total)}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                {formatPrice(p1, currency)} → {formatPrice(p2, currency)}
              </p>
            </div>
            <div className="min-w-0 rounded-lg bg-card px-3 py-3">
              <p className="text-xs text-muted-foreground">
                {projected ? "Projected annualized" : "Annualized"}
              </p>
              <p
                key={`cagr-${flashId}`}
                className={cn(
                  "span-flash span-flash-delay-2 mt-1 font-mono text-xl tabular-nums md:text-2xl",
                  cagrTone,
                )}
              >
                {cagr == null ? "—" : formatPct(cagr, 1)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {projected ? "Not a realized return" : "Compounded over the span"}
              </p>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {selA != null
            ? "Set the other date, on the chart or with the picker."
            : "Enter two dates to measure a span."}
        </p>
      )}
    </div>
  );
}
