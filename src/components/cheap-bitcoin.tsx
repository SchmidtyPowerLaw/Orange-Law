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
  const allTime = useMemo(() => cheapHistogram("all", usd), [usd]);
  if (!hist || !allTime) return null;

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
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Bitcoin’s 200-week moving average (200WMA) is the average of weekly closing prices over
        nearly four years and functions as a slowly rising long-term cost basis and historical cycle
        floor. When the market price trades near or below that line, Bitcoin has historically been
        considered cheap and in an accumulation zone at cycle bottoms; when price trades at large
        multiples above the 200WMA, it has typically been regarded as expensive and late-cycle.
        Today is{" "}
        <span className="font-mono text-primary">{allTime.current.toFixed(2)}×</span>
        {" — "}closes below the 200WMA occur{" "}
        <span className="font-mono text-foreground">{(allTime.belowShare * 100).toFixed(1)}%</span> of
        days.
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

      <div className="mt-4 min-w-0 overflow-x-hidden">
        <div
          className="flex h-[240px] w-full min-w-0 items-end gap-px pt-8 sm:h-[320px] sm:gap-2 sm:px-1 sm:pt-10"
          role="img"
          aria-label="Histogram of Bitcoin price as a multiple of the 200-week moving average"
        >
          {hist.bins.map((bin, i) => {
            const h = (bin.count / maxCount) * 100;
            const current = i === currentI;
            return (
              <div
                key={bin.label}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
              >
                {current ? (
                  <p className="relative z-10 mb-0.5 h-4 w-full sm:mb-1 sm:h-5">
                    <span className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold leading-none text-primary sm:text-xs">
                      Current {hist.current.toFixed(2)}×
                    </span>
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
                  style={{
                    height: `${Math.max(h, bin.count > 0 ? 4 : 0)}%`,
                    background: barColor(bin.lo),
                  }}
                  title={`${bin.label}: ${bin.count} days (${(bin.share * 100).toFixed(1)}%)`}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex w-full min-w-0 gap-px sm:mt-2 sm:gap-2 sm:px-1">
          {hist.bins.map((bin) => {
            const short =
              bin.hi == null
                ? `≥${fmt(bin.lo)}`
                : bin.hi - bin.lo > 0.21
                  ? `${fmt(bin.lo)}–${fmt(bin.hi)}`
                  : fmt(bin.lo);
            return (
              <p
                key={bin.label}
                className="flex h-8 min-w-0 flex-1 items-start justify-center text-center font-mono text-[7px] leading-tight text-muted-foreground sm:h-8 sm:text-[10px]"
              >
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{bin.label.replace("×", "")}</span>
              </p>
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
