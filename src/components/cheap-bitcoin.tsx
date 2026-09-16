import { useLayoutEffect, useMemo, useRef, useState } from "react";
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

function niceMax(v: number): number {
  if (v <= 10) return Math.max(10, Math.ceil(v / 5) * 5);
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  const nice = n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 8 ? 8 : 10;
  return nice * mag;
}

function yTicks(max: number): number[] {
  const step = max / 4;
  return [0, step, step * 2, step * 3, max];
}

export function CheapBitcoin({ usd }: { usd: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 420 });
  const [span, setSpan] = useState<CheapWindow>("365");
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 8 && r.height > 8) setBox({ w: r.width, h: r.height });
    };
    read();
    const obs = new ResizeObserver(read);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const hist = useMemo(() => cheapHistogram(span, usd), [span, usd]);
  const compact = box.w < 640;

  const geo = useMemo(() => {
    if (!hist) return null;
    const pad = compact
      ? { top: 42, right: 10, bottom: 42, left: 36 }
      : { top: 52, right: 18, bottom: 46, left: 48 };
    const maxCount = niceMax(Math.max(...hist.bins.map((b) => b.count), 1));
    const innerW = box.w - pad.left - pad.right;
    const innerH = box.h - pad.top - pad.bottom;
    const gap = compact ? 4 : 8;
    const bw = (innerW - gap * (hist.bins.length - 1)) / hist.bins.length;
    const xAt = (i: number) => pad.left + i * (bw + gap);
    const yAt = (c: number) => pad.top + innerH * (1 - c / maxCount);
    const currentLo = hist.bins.find((b) => {
      if (b.hi == null) return hist.current >= b.lo;
      return hist.current >= b.lo && hist.current < b.hi;
    })?.lo;
    return { pad, maxCount, innerW, innerH, gap, bw, xAt, yAt, currentLo };
  }, [hist, box, compact]);

  if (!hist || !geo) return null;

  const currentI = hist.bins.findIndex((b) => b.lo === geo.currentLo);
  const currentBin = currentI >= 0 ? hist.bins[currentI] : null;
  const calloutRight = currentI >= 0 && currentI < hist.bins.length / 2;

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
        Daily close versus the 200-week SMA of Sunday closes, forward-filled. Today is{" "}
        <span className="font-mono text-primary">{hist.current.toFixed(2)}×</span> that average
        — cheaper than {(hist.cheaperShare * 100).toFixed(0)}% of days in this window. Bitcoin
        has spent {(hist.belowShare * 100).toFixed(1)}% of days below the 200WMA.
      </p>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        {span === "365" ? "Last 365 days" : "All days with a 200-week average"} ·{" "}
        {formatDay(hist.tMin)} – {formatDay(hist.tMax)} · {hist.days.toLocaleString()} days ·
        Current {hist.current.toFixed(2)}×
      </p>

      <div
        ref={wrapRef}
        className="cheap-chart relative mt-5 -mx-9 h-[min(52svh,420px)] min-h-[280px] w-[calc(100%+4.5rem)] overflow-hidden rounded-none bg-card md:mx-0 md:h-[400px] md:min-h-[400px] md:w-full md:rounded-lg"
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${box.w} ${box.h}`}
          preserveAspectRatio="none"
          className="block"
          role="img"
          aria-label="Histogram of Bitcoin price as a multiple of the 200-week moving average"
        >
          {yTicks(geo.maxCount).map((tick) => (
            <g key={tick}>
              <line
                x1={geo.pad.left}
                x2={box.w - geo.pad.right}
                y1={geo.yAt(tick)}
                y2={geo.yAt(tick)}
                stroke="var(--color-border)"
                strokeOpacity={0.55}
              />
              <text
                x={geo.pad.left - 8}
                y={geo.yAt(tick) + 3}
                textAnchor="end"
                className="chart-tick"
              >
                {tick >= 1000 ? `${Math.round(tick / 1000)}k` : String(Math.round(tick))}
              </text>
            </g>
          ))}
          <text
            x={12}
            y={box.h / 2}
            textAnchor="middle"
            className="chart-kicker"
            transform={`rotate(-90 12 ${box.h / 2})`}
          >
            Number of days
          </text>

          {hist.bins.map((bin, i) => {
            const x = geo.xAt(i);
            const y = geo.yAt(bin.count);
            const h = Math.max(0, geo.pad.top + geo.innerH - y);
            const hot = hover === i || currentI === i;
            const fill = barColor(bin.lo);
            return (
              <g
                key={bin.label}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                className="cursor-pointer"
              >
                <rect
                  x={x}
                  y={y}
                  width={geo.bw}
                  height={h}
                  fill={fill}
                  opacity={hover != null && hover !== i && currentI !== i ? 0.38 : 1}
                  stroke={currentI === i ? "var(--color-primary)" : "transparent"}
                  strokeWidth={currentI === i ? 2 : 0}
                  rx={2}
                />
                {bin.count > 0 ? (
                  <text
                    x={x + geo.bw / 2}
                    y={Math.max(12, y - (compact ? 12 : 16))}
                    textAnchor="middle"
                    fill={hot ? "var(--color-foreground)" : "var(--color-sand)"}
                    fontSize={compact ? 8 : 11}
                    fontWeight={700}
                    fontFamily="IBM Plex Mono, ui-monospace, monospace"
                  >
                    {bin.count}
                  </text>
                ) : null}
                {bin.count > 0 ? (
                  <text
                    x={x + geo.bw / 2}
                    y={Math.max(22, y - 3)}
                    textAnchor="middle"
                    fill="var(--color-muted-foreground)"
                    fontSize={compact ? 7 : 9}
                    fontFamily="IBM Plex Mono, ui-monospace, monospace"
                  >
                    {(bin.share * 100).toFixed(1)}%
                  </text>
                ) : null}
                <text
                  x={x + geo.bw / 2}
                  y={box.h - (compact ? 16 : 18)}
                  textAnchor="middle"
                  className="chart-tick"
                  fontSize={compact ? 8 : 10}
                >
                  {bin.label}
                </text>
              </g>
            );
          })}

          {currentBin && currentI >= 0 ? (
            <g pointerEvents="none">
              {(() => {
                const cx = geo.xAt(currentI) + geo.bw / 2;
                const top = geo.yAt(currentBin.count);
                const tx = calloutRight
                  ? Math.min(box.w - geo.pad.right - 4, cx + (compact ? 70 : 110))
                  : Math.max(geo.pad.left + 4, cx - (compact ? 70 : 110));
                const ty = Math.max(14, geo.pad.top - 8);
                return (
                  <>
                    <line
                      x1={cx}
                      y1={top - 2}
                      x2={tx}
                      y2={ty + 4}
                      stroke="var(--color-primary)"
                      strokeWidth={1.4}
                    />
                    <circle cx={cx} cy={top - 2} r={3} fill="var(--color-primary)" />
                    <text
                      x={tx}
                      y={ty}
                      textAnchor={calloutRight ? "end" : "start"}
                      fill="var(--color-primary)"
                      fontSize={compact ? 10 : 12}
                      fontWeight={700}
                      fontFamily="IBM Plex Sans, sans-serif"
                    >
                      Current {hist.current.toFixed(2)}×
                    </text>
                  </>
                );
              })()}
            </g>
          ) : null}

          <text x={box.w / 2} y={box.h - 4} textAnchor="middle" className="chart-kicker">
            Bitcoin price as a multiple of the 200-week moving average
          </text>
        </svg>
      </div>

      <ul className="mt-4 flex flex-wrap gap-2">
        {WMA_LEGEND.map((item) => (
          <li
            key={item.label}
            className={cn(
              "flex items-center gap-2 rounded-lg bg-raised px-2.5 py-1.5 text-xs",
              currentBin && barColor(currentBin.lo) === item.color && "shadow-[var(--shadow-border-hover)]",
            )}
          >
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        200WMA is the 200-week simple average of Sunday closes, carried forward to each day. Not
        investment advice.
      </p>
    </section>
  );
}
