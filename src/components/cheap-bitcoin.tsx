import { useMemo, useState } from "react";
import { Segmented } from "@/components/segmented";
import { formatDay } from "@/lib/format";
import {
  WMA_LEGEND,
  barColor,
  cheapHistogram,
  type CheapWindow,
} from "@/lib/wma200";
import { cn } from "@/lib/utils";

const WINDOW_OPTIONS: { value: CheapWindow; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "365", label: "Last 365 days" },
];

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function CheapBitcoin({ usd }: { usd: number }) {
  const [span, setSpan] = useState<CheapWindow>("all");
  const hist = useMemo(() => cheapHistogram(span, usd), [span, usd]);
  if (!hist) return null;

  const maxCount = Math.max(...hist.bins.map((b) => b.count), 1);
  const currentI = hist.bins.findIndex((b, i, arr) => {
    if (i === arr.length - 1) return hist.current >= b.lo;
    return hist.current >= b.lo && hist.current < (b.hi ?? Infinity);
  });

  return (
    <section className="min-w-0 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            200-week moving average
          </p>
          <h2 className="mt-2 font-display text-2xl text-foreground">How Cheap is Bitcoin Today?</h2>
        </div>
        <Segmented
          value={span}
          onChange={setSpan}
          options={WINDOW_OPTIONS}
          ariaLabel="Histogram window"
          size="sm"
          wrap={false}
        />
      </div>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
        For each day, take that day’s USD close and divide by the 200-week average in effect that
        day (SMA of the prior 200 Sunday closes). Today is{" "}
        <span className="font-mono text-primary">{hist.current.toFixed(2)}×</span> — cheaper than{" "}
        {(hist.cheaperShare * 100).toFixed(0)}% of days here. Closes sat below the 200WMA on{" "}
        {(hist.belowShare * 100).toFixed(1)}% of days.
      </p>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        {span === "365" ? "Last 365 days only" : "All days with a 200-week average"} ·{" "}
        {formatDay(hist.tMin)} – {formatDay(hist.tMax)} · {hist.days.toLocaleString()} days · Current
        multiple {hist.current.toFixed(2)}×
      </p>

      <ul className="mt-3 flex flex-wrap justify-end gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {WMA_LEGEND.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm" style={{ background: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>

      <div className="mt-4 min-w-0 overflow-hidden">
        <div
          className="flex h-[260px] w-full min-w-0 items-end gap-px pt-8 sm:h-[340px] sm:gap-2 sm:px-1"
          role="img"
          aria-label="Histogram of Bitcoin price as a multiple of the 200-week moving average"
        >
          {hist.bins.map((bin, i) => {
            const h = (bin.count / maxCount) * 100;
            const current = i === currentI;
            const short =
              bin.hi == null
                ? `≥${fmt(bin.lo)}`
                : bin.hi - bin.lo > 0.21
                  ? `${fmt(bin.lo)}–${fmt(bin.hi)}`
                  : fmt(bin.lo);
            return (
              <div key={bin.label} className="flex h-full min-w-0 flex-1 flex-col items-center">
                <div className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-end">
                  {current ? (
                    <p className="absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-primary sm:text-xs">
                      Current {hist.current.toFixed(2)}×
                    </p>
                  ) : null}
                  {bin.count > 0 ? (
                    <p className="mb-0.5 text-center font-mono text-[7px] leading-tight text-sand sm:mb-1 sm:text-[11px]">
                      <span className="block font-semibold">{bin.count}</span>
                      <span className="block text-[6px] text-muted-foreground sm:text-[10px]">
                        {(bin.share * 100).toFixed(1)}%
                      </span>
                    </p>
                  ) : (
                    <p className="mb-0.5 font-mono text-[7px] text-muted-foreground sm:text-[10px]">0</p>
                  )}
                  <div
                    className={cn(
                      "w-full min-w-0 rounded-t-sm",
                      current && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                    )}
                    style={{ height: `${Math.max(h, bin.count > 0 ? 4 : 0)}%`, background: barColor(bin.lo) }}
                    title={`${bin.label}: ${bin.count} days (${(bin.share * 100).toFixed(1)}%)`}
                  />
                </div>
                <p className="mt-1 w-full text-center font-mono text-[7px] leading-tight text-muted-foreground sm:mt-2 sm:text-[10px]">
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{bin.label.replace("×", "")}</span>
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground sm:mt-3 sm:text-[11px]">
          Bitcoin price ÷ 200-week moving average
        </p>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Source: daily USD close. 200WMA = 200-period SMA of weekly Sunday closes, forward-filled to
        each day. Not investment advice.
      </p>
    </section>
  );
}
