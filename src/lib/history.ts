import raw from "@/data/btc-history.json";
import goldRaw from "@/data/gold-history.json";
import { daysSinceGenesis, MAX_TARGET_ISO, quantilePriceUsd, tFromIso, type QuantileId } from "@/lib/powerlaw";
import type { Currency } from "@/lib/format";
import { fxUsdTo, isOtherCode, type OtherCode } from "@/lib/fx";

export type HistoryRow = {
  t: number;
  usd: number;
  cad: number;
  xau: number;
};

export type SpanPoint = HistoryRow & {
  projected: boolean;
  band?: QuantileId;
};

export function spanFromRow(row: HistoryRow): SpanPoint {
  return { t: row.t, usd: row.usd, cad: row.cad, xau: row.xau, projected: false };
}

export function sameSpanPoint(a: SpanPoint, b: SpanPoint): boolean {
  if (a.projected !== b.projected) return false;
  if (Math.round(a.t) !== Math.round(b.t)) return false;
  if (a.projected) return a.band === b.band;
  return true;
}

type FileShape = {
  genesis: string;
  source: string;
  rows: [number, number, number][];
};

const file = raw as FileShape;
const goldFile = goldRaw as { source: string; rows: number[][] };
const GOLD_ROWS: Array<[number, number]> = goldFile.rows.map((row) => [row[0], row[1]]);

export const HISTORY_SOURCE = file.source;
export const GOLD_SOURCE = goldFile.source;

function goldUsdLookup(t: number): number {
  if (GOLD_ROWS.length === 0) return 1800;
  if (t <= GOLD_ROWS[0][0]) return GOLD_ROWS[0][1];
  let lo = 0;
  let hi = GOLD_ROWS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (GOLD_ROWS[mid][0] <= t) lo = mid;
    else hi = mid - 1;
  }
  return GOLD_ROWS[lo][1];
}

export function goldUsdAt(t: number): number {
  return goldUsdLookup(t);
}

export const HISTORY: HistoryRow[] = file.rows.map(([t, usd, cad]) => ({
  t,
  usd,
  cad,
  xau: goldUsdLookup(t),
}));

export type LiveQuote = {
  usd: number;
  cad: number;
  fx: number;
  xau: number;
  asOf: string;
  source: string;
  /** Previous UTC daily close, for calendar day-over-day. */
  prevUsd: number;
  prevCad: number;
  /** BTC in troy oz at that previous close. */
  prevXau: number;
  /** Live local-per-USD rates for extra fiat units. */
  fxOther: Partial<Record<OtherCode, number>>;
};

export function priceOf(row: HistoryRow, currency: Currency, liveXau?: number, liveFx?: number): number {
  if (currency === "XAU") {
    const gold = row.xau > 0 ? row.xau : liveXau && liveXau > 0 ? liveXau : 0;
    return gold > 0 ? row.usd / gold : 0;
  }
  if (currency === "USD") return row.usd;
  if (currency === "CAD") {
    // That day's CAD print — never freeze today's FX across the whole path.
    return row.cad > 0 ? row.cad : liveFx && liveFx > 0 && row.usd > 0 ? row.usd * liveFx : 0;
  }
  if (isOtherCode(currency)) {
    const fx = fxUsdTo(currency, row.t, liveFx);
    return row.usd > 0 && fx > 0 ? row.usd * fx : 0;
  }
  return row.usd;
}

export function priceAtDay(
  rows: HistoryRow[],
  t: number,
  currency: Currency,
  liveXau?: number,
  liveFx?: number,
): number {
  if (rows.length === 0) return 0;
  if (t <= rows[0].t) return priceOf(rows[0], currency, liveXau, liveFx);
  let lo = 0;
  let hi = rows.length - 1;
  if (t >= rows[hi].t) return priceOf(rows[hi], currency, liveXau, liveFx);
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (rows[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return priceOf(rows[lo], currency, liveXau, liveFx);
}

export function previousClose(rows: HistoryRow[]): HistoryRow | null {
  if (rows.length < 2) return null;
  const last = rows[rows.length - 1];
  for (let i = rows.length - 2; i >= 0; i--) {
    if (rows[i].t < last.t - 0.4) return rows[i];
  }
  return null;
}

/** Yesterday's print only — never a stale snapshot several days back. */
export function previousUtcClose(
  rows: HistoryRow[],
  nowT = daysSinceGenesis(),
): HistoryRow | null {
  const target = nowT - 1;
  if (rows.length === 0) return null;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (Math.abs(rows[i].t - target) < 0.4) return rows[i];
    if (rows[i].t < target - 0.4) return null;
  }
  return null;
}

export function dayChange(rows: HistoryRow[], currency: Currency): number | null {
  const last = rows[rows.length - 1];
  const prev = previousUtcClose(rows, last ? Math.round(last.t) : daysSinceGenesis());
  if (!last || !prev) return null;
  const now = priceOf(last, currency);
  const then = priceOf(prev, currency);
  if (now <= 0 || then <= 0) return null;
  return now / then - 1;
}

export function dayOverDay(
  spot: number,
  currency: Currency,
  quote: LiveQuote | null,
  rows: HistoryRow[],
): number | null {
  if (!(spot > 0)) return null;
  const prev = previousUtcClose(rows) ?? previousClose(rows);

  let then = 0;
  if (currency === "USD") {
    then = quote && quote.prevUsd > 0 ? quote.prevUsd : prev && prev.usd > 0 ? prev.usd : 0;
  } else if (currency === "CAD") {
    then = quote && quote.prevCad > 0 ? quote.prevCad : prev && prev.cad > 0 ? prev.cad : 0;
  } else if (currency === "XAU") {
    then = quote && quote.prevXau > 0 ? quote.prevXau : 0;
    if (!(then > 0) && prev && prev.usd > 0 && prev.xau > 0) then = prev.usd / prev.xau;
  } else if (isOtherCode(currency)) {
    const prevUsd = quote && quote.prevUsd > 0 ? quote.prevUsd : prev && prev.usd > 0 ? prev.usd : 0;
    const tPrev = prev ? prev.t : daysSinceGenesis() - 1;
    const fxY = fxUsdTo(currency, tPrev);
    then = prevUsd > 0 && fxY > 0 ? prevUsd * fxY : 0;
  }
  if (!(then > 0)) return null;
  return spot / then - 1;
}

export function fxOfRow(row: HistoryRow): number {
  if (row.usd <= 0) return 1;
  return row.cad / row.usd;
}

export function scaleOfRow(row: HistoryRow, currency: Currency): number {
  if (currency === "CAD") return fxOfRow(row);
  if (currency === "XAU") return row.xau > 0 ? 1 / row.xau : 0;
  if (isOtherCode(currency)) return fxUsdTo(currency, row.t);
  return 1;
}

export function mergeQuote(rows: HistoryRow[], quote: LiveQuote | null): HistoryRow[] {
  if (!quote) return rows;
  const t = daysSinceGenesis();
  const next: HistoryRow = { t, usd: quote.usd, cad: quote.cad, xau: quote.xau };
  if (rows.length === 0) return [next];
  const copy = rows.slice();
  const last = copy[copy.length - 1];
  if (last.t === t) {
    copy[copy.length - 1] = next;
  } else if (t > last.t) {
    copy.push(next);
  }
  return copy;
}

export function lastFx(rows: HistoryRow[], quote: LiveQuote | null): number {
  if (quote && quote.fx > 0) return quote.fx;
  const last = rows[rows.length - 1];
  return last ? fxOfRow(last) : 1.38;
}

export function lastXau(rows: HistoryRow[], quote: LiveQuote | null): number {
  if (quote && quote.xau > 0) return quote.xau;
  const last = rows[rows.length - 1];
  return last && last.xau > 0 ? last.xau : 1800;
}

export function lastScale(rows: HistoryRow[], quote: LiveQuote | null, currency: Currency): number {
  if (currency === "USD") return 1;
  if (currency === "CAD") return lastFx(rows, quote);
  if (isOtherCode(currency)) {
    const live = quote?.fxOther?.[currency];
    if (live && live > 0) return live;
    return fxUsdTo(currency, rows[rows.length - 1]?.t ?? 0);
  }
  const xau = lastXau(rows, quote);
  return xau > 0 ? 1 / xau : 0;
}

export function fxAt(rows: HistoryRow[], t: number, liveFx: number): number {
  const last = rows[rows.length - 1];
  if (!last) return liveFx;
  if (t >= last.t) return liveFx;
  const row = rowAtT(rows, t);
  return row ? fxOfRow(row) : liveFx;
}

export function scaleAt(
  rows: HistoryRow[],
  t: number,
  currency: Currency,
  liveFx: number,
  liveXau: number,
): number {
  if (currency === "USD") return 1;
  if (currency === "XAU") {
    const row = rowAtT(rows, t);
    const gold = row && row.xau > 0 ? row.xau : liveXau;
    return gold > 0 ? 1 / gold : 0;
  }
  const last = rows[rows.length - 1];
  if (last && t >= last.t && liveFx > 0) return liveFx;
  if (currency === "CAD") {
    const row = rowAtT(rows, t);
    return row ? fxOfRow(row) : liveFx > 0 ? liveFx : 1;
  }
  if (isOtherCode(currency)) return fxUsdTo(currency, t, liveFx);
  return liveFx > 0 ? liveFx : 1;
}

export function rowAtT(rows: HistoryRow[], t: number): HistoryRow | null {
  if (rows.length === 0) return null;
  if (t >= rows[rows.length - 1].t) return rows[rows.length - 1];
  if (t <= rows[0].t) return rows[0];
  let lo = 0;
  let hi = rows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (rows[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return rows[lo];
}

export type ChartRange = "all" | "10y" | "5y" | "3y" | "1y" | "6m";

export const CHART_RANGES: readonly ChartRange[] = [
  "all",
  "10y",
  "5y",
  "3y",
  "1y",
  "6m",
] as const;

export const CHART_RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: "all", label: "All" },
  { value: "10y", label: "10Y" },
  { value: "5y", label: "5Y" },
  { value: "3y", label: "3Y" },
  { value: "1y", label: "1Y" },
  { value: "6m", label: "6M" },
];

export function isChartRange(value: unknown): value is ChartRange {
  return CHART_RANGES.includes(value as ChartRange);
}

export function migrateChartRange(value: unknown): ChartRange {
  if (value === "8y") return "10y";
  if (value === "4y") return "5y";
  return isChartRange(value) ? value : "all";
}

export const RANGE_DAYS: Record<ChartRange, number | null> = {
  all: null,
  "10y": Math.round(10 * 365.25),
  "5y": Math.round(5 * 365.25),
  "3y": Math.round(3 * 365.25),
  "1y": Math.round(365.25),
  "6m": Math.round(365.25 / 2),
};

const TEN_YEARS = Math.round(10 * 365.25);
const ONE_YEAR = Math.round(365.25);
const COMPACT_FORWARD = ONE_YEAR;

export function rangeWindow(
  range: ChartRange,
  tNow: number,
  tStart: number,
  opts?: { compact?: boolean; future?: boolean },
): { tMin: number; tMax: number } {
  const lookback = RANGE_DAYS[range];
  const tMin = lookback == null ? tStart : Math.max(tStart, tNow - lookback);
  const desktopForward = lookback == null ? TEN_YEARS : Math.min(TEN_YEARS, Math.max(lookback, ONE_YEAR));
  const capForward = opts?.compact && !opts?.future;
  const forward = capForward ? Math.min(desktopForward, COMPACT_FORWARD) : desktopForward;
  return { tMin, tMax: tNow + forward };
}

export const MIN_ZOOM_DAYS = 45;

export function clampTimeWindow(
  tMin: number,
  tMax: number,
  absMin: number,
  absMax: number,
): { tMin: number; tMax: number } {
  let lo = Math.min(tMin, tMax);
  let hi = Math.max(tMin, tMax);
  lo = Math.max(absMin, lo);
  hi = Math.min(absMax, hi);
  if (hi - lo < MIN_ZOOM_DAYS) {
    const mid = (lo + hi) / 2;
    lo = mid - MIN_ZOOM_DAYS / 2;
    hi = mid + MIN_ZOOM_DAYS / 2;
    if (lo < absMin) {
      lo = absMin;
      hi = Math.min(absMax, absMin + MIN_ZOOM_DAYS);
    }
    if (hi > absMax) {
      hi = absMax;
      lo = Math.max(absMin, absMax - MIN_ZOOM_DAYS);
    }
  }
  return { tMin: lo, tMax: hi };
}

export function spanFromIso(
  iso: string,
  rows: HistoryRow[],
  liveFx: number,
  liveXau = 1800,
): SpanPoint | null {
  const tRaw = tFromIso(iso);
  if (tRaw == null || rows.length === 0) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const maxT = tFromIso(MAX_TARGET_ISO) ?? last.t + TEN_YEARS;
  const t = Math.min(maxT, Math.max(first.t, tRaw));
  if (t <= last.t) {
    const row = rowAtT(rows, t) ?? last;
    return { t: row.t, usd: row.usd, cad: row.cad, xau: row.xau, projected: false };
  }
  const usd = quantilePriceUsd(t, 0);
  const fx = liveFx > 0 ? liveFx : 1;
  const xau = liveXau > 0 ? liveXau : last.xau;
  return { t, usd, cad: usd * fx, xau, projected: true, band: "fair" };
}

export const QUANTILE_TONE: Record<QuantileId, string> = {
  break: "var(--chart-break)",
  floor: "var(--chart-floor)",
  low: "var(--chart-low)",
  fair: "var(--chart-fair)",
  high: "var(--chart-high)",
  top: "var(--chart-top)",
};
