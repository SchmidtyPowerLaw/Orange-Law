import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { isoFromDay } from "@/lib/powerlaw";
import { HISTORY } from "@/lib/history";
import {
  BTC_ORANGE,
  SPX_WHITE,
  crossoverT,
  diminishingReturnSeries,
  dollarGrowthSeries,
  formatAxisMultiple,
  formatMultiple,
  formatReturnPct,
  nearestPoint,
  powerLawOneYearReturn,
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
  key: SeriesId,
  xAt: (t: number) => number,
  yAt: (v: number) => number,
): string {
  let d = "";
  for (const pt of points) {
    const v = pt[key];
    if (!(v > 0)) continue;
    const x = xAt(pt.t);
    const y = yAt(v);
    d += d ? ` L ${x.toFixed(1)} ${y.toFixed(1)}` : `M ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
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
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 540 });
  const [hover, setHover] = useState<VsPoint | null>(null);
  const [focusId, setFocusId] = useState<SeriesId | null>(null);
  const compact = box.w < 640;
  const pad = compact
    ? { top: 28, right: endLabels ? 68 : 14, bottom: 36, left: 44 }
    : { top: 32, right: endLabels ? 86 : 18, bottom: 40, left: 52 };

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
      const u = logY
        ? logLerp(yMin, yMax, Math.min(yMax, Math.max(yMin, v)))
        : linLerp(yMin, yMax, Math.min(yMax, Math.max(yMin, v)));
      return pad.top + (1 - u) * (box.h - pad.top - pad.bottom);
    };
    const tAt = (x: number) => {
      const u = (x - pad.left) / Math.max(1, box.w - pad.left - pad.right);
      return tMin + Math.min(1, Math.max(0, u)) * (tMax - tMin);
    };
    return { tMin, tMax, xAt, yAt, tAt };
  }, [series, box, pad.left, pad.right, pad.top, pad.bottom, yMin, yMax, logY]);

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
  const btcD = geo ? pathOf(series, "btc", geo.xAt, geo.yAt) : "";
  const spxD = geo ? pathOf(series, "spx", geo.xAt, geo.yAt) : "";
  const tipLeft =
    hover && geo ? Math.min(Math.max(geo.xAt(hover.t) + 10, pad.left + 4), box.w - pad.right - 168) : 0;

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
                  stroke="var(--color-border)"
                  strokeOpacity={0.55}
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
                <text
                  x={geo.xAt(todayT) + 8}
                  y={Math.max(pad.top + 22, geo.yAt(nearestPoint(series, todayT)?.btc ?? yMin) - 8)}
                  className="chart-kicker"
                  style={{ fill: "var(--color-floor)" }}
                >
                  today
                </text>
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
                  strokeOpacity={0.35}
                  strokeDasharray="5 4"
                />
                <text
                  x={Math.max(pad.left + 4, geo.xAt(markT) - 6)}
                  y={pad.top + 14}
                  textAnchor="end"
                  className="chart-kicker"
                  style={{ fill: SPX_WHITE }}
                >
                  {markLabel}
                </text>
              </>
            ) : null}

            <path
              d={spxD}
              fill="none"
              stroke={SPX_WHITE}
              strokeWidth={focusId === "btc" ? 1.2 : 2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={focusId === "btc" ? 0.18 : 1}
            />
            <path
              d={btcD}
              fill="none"
              stroke={BTC_ORANGE}
              strokeWidth={focusId === "spx" ? 1.6 : 2.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={focusId === "spx" ? 0.18 : 1}
              filter={`url(#${id}-glow)`}
            />

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
                <circle cx={geo.xAt(hover.t)} cy={geo.yAt(hover.spx)} r={3.4} fill={SPX_WHITE} />
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
        <span className="text-sand">{formatReturnPct(todayRet)}</span> year versus about 10% for the
        S&P 500. Drag either chart. Tap a name to isolate the line.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat
          label="Power-law 1 year"
          value={formatReturnPct(todayRet)}
          hint="implied, today"
          color={BTC_ORANGE}
        />
        <Stat label="S&P 500 long-run" value="~10%" hint="total return" color={SPX_WHITE} />
        <Stat
          label="Meets 10%"
          value={crossIso.slice(0, 4)}
          hint={crossIso}
          color={SPX_WHITE}
        />
        <Stat
          label={`$1 since ${startYear}`}
          value={lastDollar ? formatMultiple(lastDollar.btc) : "—"}
          hint={lastDollar ? `S&P ${formatMultiple(lastDollar.spx)}` : "—"}
          color={BTC_ORANGE}
        />
      </div>

      <div className="mt-8 grid gap-10">
        <DualChart
          id="pl-return"
          title="Power-law annualized return"
          kicker="Forward one-year return of P \u221d t\u2075\u00b7\u2079 versus the S&P 500\u2019s long-run ~10% total return. From Bitcoin\u2019s first traded prints in 2010 through 2070."
          xLabel="annualized return (log)|year"
          series={RETURN_SERIES}
          yMin={0.05}
          yMax={20}
          logY
          formatY={(v) => `${Math.round(v * 100).toLocaleString("en-CA")}%`}
          formatValue={(pt, key) => formatReturnPct(pt[key])}
          yearTicks={[2010, 2015, 2020, 2025, 2030, 2040, 2050, 2060, 2070]}
          todayT={todayT}
          markT={CROSS_T}
          markLabel={`meets 10% \u00b7 ${crossIso.slice(0, 4)}`}
          yTickValues={[0.05, 0.1, 0.5, 1, 5, 10, 20]}
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
