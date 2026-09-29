import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { isoFromDay } from "@/lib/powerlaw";
import { HISTORY } from "@/lib/history";
import {
  BTC_ORANGE,
  CAP_MARKS,
  SPX_LONG_RUN,
  SPX_WHITE,
  crossoverT,
  diminishingReturnSeries,
  dollarGrowthSeries,
  formatAxisMultiple,
  formatCapTrillions,
  formatMultiple,
  formatReturnPct,
  latestSpxTrailing,
  nearestPoint,
  powerLawOneYearReturn,
  type CapMark,
  type VsPoint,
} from "@/lib/stocks-or-bitcoin";
import { cn } from "@/lib/utils";

type SeriesId = "btc" | "spx";

const RETURN_SERIES = diminishingReturnSeries();
const DOLLAR_SERIES = dollarGrowthSeries();
const CROSS_T = crossoverT();

function logLerp(a: number, b: number, x: number) {
  return (Math.log10(x) - Math.log10(a)) / (Math.log10(b) - Math.log10(a));
}

function linLerp(a: number, b: number, x: number) {
  return (x - a) / (b - a);
}

function pathOf(
  points: VsPoint[],
  valueOf: (pt: VsPoint) => number | null,
  xAt: (t: number) => number,
  yAt: (v: number) => number,
): string {
  let d = "";
  for (const pt of points) {
    const v = valueOf(pt);
    if (v == null || !Number.isFinite(v)) continue;
    const x = xAt(pt.t);
    const y = yAt(v);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    d += d ? ` L ${x.toFixed(1)} ${y.toFixed(1)}` : `M ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

/** Sideways label that reads up the page, sitting along a vertical rule. */
function VerticalRuleLabel({
  x,
  y,
  fill,
  children,
  side = "left",
}: {
  x: number;
  y: number;
  fill: string;
  children: string;
  side?: "left" | "right";
}) {
  const tx = x + (side === "left" ? -8 : 8);
  return (
    <text
      x={tx}
      y={y}
      transform={`rotate(-90 ${tx} ${y})`}
      textAnchor="middle"
      dominantBaseline="middle"
      className="chart-kicker"
      style={{ fill }}
    >
      {children}
    </text>
  );
}

function DualChart({
  id,
  title,
  kicker,
  xLabel,
  series,
  yMin,
  yMax,
  logY,
  formatY,
  formatValue,
  yearTicks,
  todayT,
  markT,
  markLabel,
  endLabels,
  yTickValues,
  marks,
  splitT,
  futureFlat,
  yScale = "linear",
}: {
  id: string;
  title: string;
  kicker: string;
  xLabel: string;
  series: VsPoint[];
  yMin: number;
  yMax: number;
  logY: boolean;
  formatY: (v: number) => string;
  formatValue: (pt: VsPoint, key: SeriesId) => string;
  yearTicks: number[];
  todayT: number;
  markT?: number;
  markLabel?: string;
  endLabels?: boolean;
  yTickValues?: number[];
  marks?: CapMark[];
  /** Draw t > splitT dashed. The boundary point is included in both strokes. */
  splitT?: number;
  /** Future S&P values are the long-run 10%, not the stored point. */
  futureFlat?: boolean;
  yScale?: "linear" | "log" | "symlog";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 540 });
  const [hover, setHover] = useState<VsPoint | null>(null);
  const [focusId, setFocusId] = useState<SeriesId | null>(null);
  const compact = box.w < 640;
  const pad = compact
    ? { top: 28, right: endLabels ? 68 : 14, bottom: 36, left: yScale === "symlog" ? 46 : 44 }
    : { top: 32, right: endLabels ? 86 : 18, bottom: 40, left: yScale === "symlog" ? 58 : 52 };

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

  const geo = useMemo(() => {
    if (series.length === 0) return null;
    const tMin = series[0]!.t;
    const tMax = series[series.length - 1]!.t;
    const xAt = (t: number) =>
      pad.left + linLerp(tMin, tMax, Math.min(tMax, Math.max(tMin, t))) * (box.w - pad.left - pad.right);
    const yAt = (v: number) => {
      const clamped = Math.min(yMax, Math.max(yMin, v));
      let u: number;
      if (yScale === "symlog") {
        const s = (x: number) => Math.sign(x) * Math.log10(1 + Math.abs(x) / 0.1);
        u = (s(clamped) - s(yMin)) / (s(yMax) - s(yMin));
      } else if (logY || yScale === "log") {
        u = logLerp(yMin, yMax, clamped);
      } else {
        u = linLerp(yMin, yMax, clamped);
      }
      return pad.top + (1 - u) * (box.h - pad.top - pad.bottom);
    };
    const tAt = (x: number) => {
      const u = (x - pad.left) / Math.max(1, box.w - pad.left - pad.right);
      return tMin + Math.min(1, Math.max(0, u)) * (tMax - tMin);
    };
    return { tMin, tMax, xAt, yAt, tAt };
  }, [series, box, pad.left, pad.right, pad.top, pad.bottom, yMin, yMax, logY, yScale]);

  const yTicks = useMemo(() => {
    if (yTickValues?.length) return yTickValues;
    if (logY) {
      const ticks: number[] = [];
      const a = Math.ceil(Math.log10(yMin) - 1e-9);
      const b = Math.floor(Math.log10(yMax) + 1e-9);
      for (let e = a; e <= b; e++) ticks.push(10 ** e);
      return ticks.filter((v) => v >= yMin * 0.98 && v <= yMax * 1.02);
    }
    const step = yMax <= 1 ? 0.2 : 0.25;
    const ticks: number[] = [];
    for (let v = 0; v <= yMax + 1e-9; v += step) ticks.push(v);
    return ticks;
  }, [logY, yMin, yMax, yTickValues]);

  const shownYears = useMemo(() => {
    if (!compact || yearTicks.length <= 6) return yearTicks;
    return yearTicks.filter((_, i) => i % 2 === 0 || i === yearTicks.length - 1);
  }, [compact, yearTicks]);

  const onMove = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (!geo) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * box.w;
    if (x < pad.left || x > box.w - pad.right) {
      setHover(null);
      return;
    }
    setHover(nearestPoint(series, geo.tAt(x)));
  };

  const last = series[series.length - 1] ?? null;
  const active = hover ?? (todayT ? nearestPoint(series, todayT) : last);
  const tipLeft =
    hover && geo ? Math.min(Math.max(geo.xAt(hover.t) + 10, pad.left + 4), box.w - pad.right - 168) : 0;
  const ruleLabelY = pad.top + (box.h - pad.top - pad.bottom) * 0.36;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{kicker}</p>
        </div>
      </div>
      <div
        ref={wrapRef}
        className="nature-chart relative mt-3 w-full overflow-hidden rounded-lg bg-card"
      >
        {hover && geo ? (
          <div
            className="pointer-events-none absolute top-3 z-10 min-w-[9.5rem] rounded-md bg-raised/95 px-2.5 py-1.5 shadow-[var(--shadow-border)]"
            style={{ left: tipLeft }}
          >
            <p className="font-mono text-[10px] tabular-nums text-muted-foreground">{isoFromDay(hover.t)}</p>
            <p className="mt-0.5 font-mono text-xs tabular-nums" style={{ color: BTC_ORANGE }}>
              BTC {formatValue(hover, "btc")}
            </p>
            <p className="font-mono text-xs tabular-nums" style={{ color: SPX_WHITE }}>
              SPX {formatValue(hover, "spx")}
            </p>
          </div>
        ) : null}
        {geo ? (
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${box.w} ${box.h}`}
            preserveAspectRatio="none"
            className="block touch-none select-none"
            role="img"
            aria-label={title}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            onPointerDown={onMove}
          >
            <defs>
              <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {yTicks.map((v) => (
              <g key={`y-${v}`}>
                <line
                  x1={pad.left}
                  x2={box.w - pad.right}
                  y1={geo.yAt(v)}
                  y2={geo.yAt(v)}
                  stroke={v === 0 ? "var(--color-sand)" : "var(--color-border)"}
                  strokeOpacity={v === 0 ? 0.7 : 0.55}
                />
                <text x={pad.left - 8} y={geo.yAt(v) + 3} textAnchor="end" className="chart-tick">
                  {formatY(v)}
                </text>
              </g>
            ))}
            {shownYears.map((year, i) => {
              const tRaw = Math.round((Date.UTC(year, 0, 1) - Date.UTC(2009, 0, 3)) / 86_400_000);
              if (tRaw > geo.tMax) return null;
              const atLeft = tRaw < geo.tMin;
              if (atLeft && i !== 0) return null;
              const t = Math.max(geo.tMin, tRaw);
              const x = geo.xAt(t);
              return (
                <g key={`x-${year}`}>
                  {!atLeft ? (
                    <line
                      x1={x}
                      x2={x}
                      y1={pad.top}
                      y2={box.h - pad.bottom}
                      stroke="var(--color-border)"
                      strokeOpacity={0.4}
                    />
                  ) : null}
                  <text
                    x={x}
                    y={box.h - 14}
                    textAnchor={atLeft ? "start" : "middle"}
                    className="chart-tick"
                  >
                    {year}
                  </text>
                </g>
              );
            })}
            <text x={pad.left} y={16} className="chart-kicker">
              {xLabel.split("|")[0]}
            </text>
            <text x={box.w / 2} y={box.h - 2} textAnchor="middle" className="chart-kicker">
              {xLabel.split("|")[1] ?? "year"}
            </text>

            {todayT >= geo.tMin && todayT <= geo.tMax && geo.tMax - todayT > (geo.tMax - geo.tMin) * 0.04 ? (
              <>
                <line
                  x1={geo.xAt(todayT)}
                  x2={geo.xAt(todayT)}
                  y1={pad.top}
                  y2={box.h - pad.bottom}
                  stroke="var(--chart-today)"
                  strokeWidth={1}
                  strokeDasharray="2 4"
                />
                <VerticalRuleLabel
                  x={geo.xAt(todayT)}
                  y={ruleLabelY}
                  fill="var(--color-floor)"
                >
                  Today
                </VerticalRuleLabel>
              </>
            ) : null}

            {markT != null && markT >= geo.tMin && markT <= geo.tMax ? (
              <>
                <line
                  x1={geo.xAt(markT)}
                  x2={geo.xAt(markT)}
                  y1={pad.top}
                  y2={box.h - pad.bottom}
                  stroke={SPX_WHITE}
                  strokeOpacity={0.75}
                  strokeDasharray="5 4"
                />
                <VerticalRuleLabel
                  x={geo.xAt(markT)}
                  y={ruleLabelY}
                  fill={SPX_WHITE}
                >
                  {markLabel ?? ""}
                </VerticalRuleLabel>
              </>
            ) : null}

            {geo
              ? (["spx", "btc"] as const).flatMap((key) =>
                  (splitT != null ? (["past", "future"] as const) : (["all"] as const)).map((era) => {
                    const d = pathOf(
                      series,
                      (pt) => {
                        if (era === "past" && splitT != null && pt.t > splitT) return null;
                        if (era === "future" && splitT != null && pt.t < splitT) return null;
                        const v =
                          era === "future" && key === "btc"
                            ? powerLawOneYearReturn(pt.t)
                            : era === "future" && key === "spx" && futureFlat
                              ? SPX_LONG_RUN
                              : pt[key];
                        if (!Number.isFinite(v)) return null;
                        if (logY && !(v > 0)) return null;
                        return v;
                      },
                      geo.xAt,
                      geo.yAt,
                    );
                    if (!d) return null;
                    const dim = focusId != null && focusId !== key;
                    const btc = key === "btc";
                    return (
                      <path
                        key={`${key}-${era}`}
                        d={d}
                        fill="none"
                        stroke={btc ? BTC_ORANGE : SPX_WHITE}
                        strokeWidth={btc ? (dim ? 1.6 : 2.8) : dim ? 1.2 : 2.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={era === "future" ? "6 4" : undefined}
                        opacity={dim ? 0.18 : 1}
                        filter={btc ? `url(#${id}-glow)` : undefined}
                      />
                    );
                  }),
                )
              : null}

            {geo && splitT != null ? (
              <>
                <path
                  d={pathOf(
                    series,
                    (pt) => (pt.t <= splitT ? powerLawOneYearReturn(pt.t) : null),
                    geo.xAt,
                    geo.yAt,
                  )}
                  fill="none"
                  stroke={BTC_ORANGE}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={focusId === "spx" ? 0.12 : 0.72}
                />
                <text
                  {...(() => {
                    const t0 = series[0]!.t;
                    const t2012 = Math.round((Date.UTC(2012, 0, 1) - Date.UTC(2009, 0, 3)) / 86_400_000);
                    const t1 = Math.min(Math.max(t2012, t0 + 30), splitT);
                    const x0 = geo.xAt(t0);
                    const y0 = geo.yAt(powerLawOneYearReturn(t0));
                    const x1 = geo.xAt(t1);
                    const y1 = geo.yAt(powerLawOneYearReturn(t1));
                    const dx = x1 - x0;
                    const dy = y1 - y0;
                    const len = Math.hypot(dx, dy) || 1;
                    let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
                    let ux = dx / len;
                    let uy = dy / len;
                    if (ang > 90 || ang < -90) {
                      ang += ang > 0 ? -180 : 180;
                      ux = -ux;
                      uy = -uy;
                    }
                    const fontPx = compact ? 12 : 15;
                    const textLen = 16 * fontPx * 0.52;
                    const gap = fontPx * 0.95;
                    const along = Math.min(len * 0.12, 8);
                    const minX = pad.left + 4;
                    const maxX = box.w - pad.right - 8;
                    const minY = pad.top + 10;
                    const maxY = box.h - pad.bottom - 8;
                    const perps = [
                      { x: -uy, y: ux },
                      { x: uy, y: -ux },
                    ];
                    let best: { x: number; y: number; score: number } | null = null;
                    for (const p of perps) {
                      const ax = x0 + ux * along + p.x * gap;
                      const ay = y0 + uy * along + p.y * gap;
                      const ex = ax + ux * textLen;
                      const ey = ay + uy * textLen;
                      const inside =
                        ax >= minX && ax <= maxX && ay >= minY && ay <= maxY &&
                        ex >= minX && ex <= maxX && ey >= minY && ey <= maxY;
                      const score = (inside ? 4 : 0) + (p.y > 0 ? 2 : 0) + (p.x > 0 ? 1 : 0);
                      if (!best || score > best.score) best = { x: ax, y: ay, score };
                    }
                    const ax = best!.x;
                    const ay = Math.min(maxY - 8, best!.y + gap * 0.7);
                    return {
                      x: ax,
                      y: ay,
                      transform: `rotate(${ang.toFixed(2)} ${ax.toFixed(1)} ${ay.toFixed(1)})`,
                    };
                  })()}
                  textAnchor="start"
                  dominantBaseline="middle"
                  stroke="#120c08"
                  strokeWidth={5}
                  paintOrder="stroke"
                  strokeLinejoin="round"
                  className="chart-kicker"
                  style={{
                    fill: "#f6f1e6",
                    fontSize: compact ? 12 : 15,
                    fontWeight: 700,
                    letterSpacing: "0.03em",
                    opacity: focusId === "spx" ? 0.35 : 1,
                  }}
                >
                  Power Law 1 Year
                </text>
              </>
            ) : null}

            {marks?.map((mark) => {
              if (!geo || mark.t < geo.tMin || mark.t > geo.tMax) return null;
              const pt = nearestPoint(series, mark.t);
              if (!pt) return null;
              const x = geo.xAt(mark.t);
              const y = geo.yAt(pt.btc);
              const year = isoFromDay(mark.t).slice(0, 4);
              return (
                <g key={mark.id} opacity={focusId === "spx" ? 0.2 : 1}>
                  <line
                    x1={x}
                    x2={x}
                    y1={pad.top}
                    y2={box.h - pad.bottom}
                    stroke={mark.color}
                    strokeOpacity={0.5}
                    strokeDasharray="3 4"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={5}
                    fill={mark.color}
                    stroke="#050505"
                    strokeWidth={1.2}
                  />
                  <VerticalRuleLabel x={x} y={ruleLabelY} fill={mark.color} side="right">
                    {`${mark.name} (${year})`}
                  </VerticalRuleLabel>
                </g>
              );
            })}

            {endLabels && last ? (
              <>
                <circle cx={geo.xAt(last.t)} cy={geo.yAt(last.spx)} r={3} fill={SPX_WHITE} />
                <text
                  x={geo.xAt(last.t) + 6}
                  y={geo.yAt(last.spx) + 3}
                  className="chart-kicker"
                  style={{ fill: SPX_WHITE }}
                >
                  {formatValue(last, "spx")}
                </text>
                <circle cx={geo.xAt(last.t)} cy={geo.yAt(last.btc)} r={3.4} fill={BTC_ORANGE} />
                <text
                  x={geo.xAt(last.t) + 6}
                  y={geo.yAt(last.btc) + 3}
                  className="chart-kicker"
                  style={{ fill: BTC_ORANGE }}
                >
                  {formatValue(last, "btc")}
                </text>
              </>
            ) : null}

            {hover ? (
              <>
                <line
                  x1={geo.xAt(hover.t)}
                  x2={geo.xAt(hover.t)}
                  y1={pad.top}
                  y2={box.h - pad.bottom}
                  stroke="var(--color-sand)"
                  strokeOpacity={0.35}
                />
                <circle cx={geo.xAt(hover.t)} cy={geo.yAt(hover.btc)} r={4} fill={BTC_ORANGE} />
                {Number.isFinite(hover.spx) ? (
                  <circle cx={geo.xAt(hover.t)} cy={geo.yAt(hover.spx)} r={3.4} fill={SPX_WHITE} />
                ) : null}
              </>
            ) : null}
          </svg>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(
          [
            { id: "btc" as const, name: "Bitcoin", color: BTC_ORANGE },
            { id: "spx" as const, name: "S&P 500", color: SPX_WHITE },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={focusId === item.id}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-lg bg-raised px-3 py-2 text-sm touch-manipulation",
              focusId === item.id && "shadow-[var(--shadow-border-hover)]",
            )}
            onClick={() => setFocusId((cur) => (cur === item.id ? null : item.id))}
          >
            <span className="h-0.5 w-5 rounded-full" style={{ background: item.color }} />
            <span style={{ color: item.color }}>{item.name}</span>
          </button>
        ))}
        {splitT != null ? (
          <p className="flex min-h-11 items-center gap-2 px-1 text-sm" style={{ color: BTC_ORANGE, opacity: 0.7 }}>
            <span className="h-0.5 w-5 rounded-full" style={{ background: BTC_ORANGE, opacity: 0.45 }} />
            Power Law 1 Year, through today
          </p>
        ) : null}
        {active && !hover ? (
          <p className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
            {isoFromDay(active.t)}
            <span className="ml-2" style={{ color: BTC_ORANGE }}>
              {formatValue(active, "btc")}
            </span>
            <span className="ml-2" style={{ color: SPX_WHITE }}>
              {formatValue(active, "spx")}
            </span>
          </p>
        ) : null}
      </div>
      {splitT != null ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Solid is actual history. The faint line is the power-law one-year return through today. Dashed is projected.
        </p>
      ) : null}
      {marks && marks.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {marks.map((mark) => (
            <p key={mark.id} className="font-mono text-[11px] tabular-nums" style={{ color: mark.color }}>
              {mark.name} ({isoFromDay(mark.t).slice(0, 4)})
              <span className="ml-1.5 text-muted-foreground">{formatCapTrillions(mark.capUsd)}</span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg bg-raised px-3 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl tabular-nums" style={color ? { color } : undefined}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function StocksOrBitcoin() {
  const todayT = HISTORY[HISTORY.length - 1]?.t ?? 0;
  const todayRet = powerLawOneYearReturn(todayT);
  const lastDollar = DOLLAR_SERIES[DOLLAR_SERIES.length - 1];
  const firstDollar = DOLLAR_SERIES[0];
  const crossIso = isoFromDay(CROSS_T);
  const startYear = firstDollar ? isoFromDay(firstDollar.t).slice(0, 4) : "2010";
  const spxNow = latestSpxTrailing();

  return (
    <section
      id="stocks-or-bitcoin"
      className="min-w-0 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] md:p-6"
    >
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Equities</p>
      <h2 className="mt-2 font-display text-2xl text-foreground">Stocks or Bitcoin?</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
        The power law is a diminishing-return curve: the same exponent on a larger age each year, so
        the implied one-year gain shrinks. Today that path still prices a{" "}
        <span className="text-sand">{formatReturnPct(todayRet)}</span> year. On the chart, both
        lines are actual trailing one-year returns through today. After today bitcoin follows the
        power law and the S&P follows 10%, both dashed.
        Drag either chart. Tap a name to isolate the line.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat
          label="Power-law 1 year"
          value={formatReturnPct(todayRet)}
          hint="implied, today"
          color={BTC_ORANGE}
        />
        <Stat
          label="S&P 500, 1 year"
          value={spxNow ? formatReturnPct(spxNow.ret) : "\u2014"}
          hint="actual trailing total return"
          color={SPX_WHITE}
        />
        <Stat
          label="Meets 10%"
          value={crossIso.slice(0, 4)}
          hint={crossIso}
          color={SPX_WHITE}
        />
        <Stat
          label={`$1 since ${startYear}`}
          value={lastDollar ? formatMultiple(lastDollar.btc) : "\u2014"}
          hint={lastDollar ? `S&P ${formatMultiple(lastDollar.spx)}` : "\u2014"}
          color={BTC_ORANGE}
        />
      </div>

      <div className="mt-8 grid gap-10">
        <DualChart
          id="pl-return"
          title="One-year return"
          kicker="Solid lines are trailing one-year returns through today. The faint orange line is the smoothed power-law one-year return, also through today. Dashed bitcoin continues that power law. Dashed S&P is a 10% assumption."
          xLabel="annualized return|year"
          series={RETURN_SERIES}
          yMin={-0.9}
          yMax={300}
          logY={false}
          yScale="symlog"
          formatY={(v) => {
            const pct = Math.round(v * 100);
            const abs = Math.abs(pct);
            const body = abs >= 10000 ? `${Math.round(pct / 1000)}k%` : `${pct.toLocaleString("en-CA")}%`;
            return body;
          }}
          formatValue={(pt, key) => formatReturnPct(pt[key])}
          yearTicks={[2010, 2015, 2020, 2025, 2030, 2040, 2050, 2060, 2070]}
          todayT={todayT}
          splitT={todayT}
          futureFlat
          markT={CROSS_T}
          markLabel={`Meets 10% ${crossIso.slice(0, 4)}`}
          yTickValues={[-0.5, 0, 0.1, 1, 10, 100]}
          marks={CAP_MARKS}
        />

        <DualChart
          id="dollar-log"
          title="Growth of $1 (log)"
          kicker={`$1 in bitcoin versus $1 in the S&P 500 total-return index from July 2010. Dividends stay in.`}
          xLabel="multiple of starting $1 (log)|year"
          series={DOLLAR_SERIES}
          yMin={0.5}
          yMax={Math.max(2_000_000, lastDollar ? lastDollar.btc * 1.4 : 2_000_000)}
          logY
          formatY={formatAxisMultiple}
          formatValue={(pt, key) => formatMultiple(pt[key])}
          yearTicks={[2010, 2013, 2015, 2017, 2019, 2021, 2023, 2025]}
          todayT={todayT}
          endLabels
        />
      </div>
    </section>
  );
}
