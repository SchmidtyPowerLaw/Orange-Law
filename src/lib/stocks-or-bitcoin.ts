import { HISTORY } from "@/lib/history";
import { assetSeries } from "@/lib/compare";
import {
  BETA,
  DAYS_PER_YEAR,
  GENESIS_UTC,
  MS_PER_DAY,
  T_MODEL_START,
  fairPriceUsd,
  isoFromDay,
} from "@/lib/powerlaw";

export const BTC_ORANGE = "#ff5a12";
export const SPX_WHITE = "#f4ead8";
export const SPX_LONG_RUN = 0.1;
export const GOLD_COLOR = "#e0b84a";
export const CAD_COLOR = "#e31837";
export const BONDS_COLOR = "#c84bff";

/** Canada private non-financial credit, ~USD, 2026. */
export const CAD_SYSTEM_USD = 5.2e12;
/** Above-ground gold stock, Sept 2026. */
export const GOLD_STOCK_USD = 31e12;
/** Global bond market, 2026. */
export const GLOBAL_BONDS_USD = 145e12;

export type VsPoint = { t: number; year: number; btc: number; spx: number };

export type CapMark = {
  id: "cad" | "gold" | "bonds";
  name: string;
  color: string;
  capUsd: number;
  t: number;
};

function tFromUtc(ms: number): number {
  return Math.floor((ms - GENESIS_UTC) / MS_PER_DAY);
}

function lookup(series: { t: number; usd: number }[], t: number): number | null {
  if (series.length === 0) return null;
  if (t < series[0]!.t) return null;
  let lo = 0;
  let hi = series.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (series[mid]!.t <= t) lo = mid;
    else hi = mid - 1;
  }
  return series[lo]!.usd;
}

function btcSupply(tDays: number): number {
  let blocks = Math.max(0, tDays * 144);
  let supply = 0;
  let subsidy = 50;
  for (let era = 0; era < 12 && blocks > 0; era++) {
    const take = Math.min(blocks, 210_000);
    supply += take * subsidy;
    blocks -= take;
    subsidy /= 2;
  }
  return supply;
}

export function powerLawMcapUsd(t: number): number {
  return fairPriceUsd(t) * btcSupply(t);
}

export function tWhenMcapEquals(targetUsd: number): number {
  let lo = T_MODEL_START;
  let hi = 80_000;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (powerLawMcapUsd(mid) < targetUsd) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const CAP_MARKS: CapMark[] = (
  [
    { id: "cad" as const, name: "CAD", color: CAD_COLOR, capUsd: CAD_SYSTEM_USD },
    { id: "gold" as const, name: "Gold", color: GOLD_COLOR, capUsd: GOLD_STOCK_USD },
    { id: "bonds" as const, name: "Bonds", color: BONDS_COLOR, capUsd: GLOBAL_BONDS_USD },
  ] as const
).map((row) => ({ ...row, t: tWhenMcapEquals(row.capUsd) }));

/** Forward 1-year return implied by P ~ t^beta. */
export function powerLawOneYearReturn(t: number): number {
  if (t <= 0) return Number.NaN;
  return (t + DAYS_PER_YEAR) ** BETA / t ** BETA - 1;
}

/** Monthly power-law 1y return vs a flat S&P long-run, July 2010 to 2070. */
export function diminishingReturnSeries(): VsPoint[] {
  const start = T_MODEL_START;
  const end = tFromUtc(Date.UTC(2070, 0, 1));
  const out: VsPoint[] = [];
  for (let t = start; t <= end; t += 30) {
    const iso = isoFromDay(t);
    out.push({
      t,
      year: Number(iso.slice(0, 4)) + (Number(iso.slice(5, 7)) - 1) / 12,
      btc: powerLawOneYearReturn(t),
      spx: SPX_LONG_RUN,
    });
  }
  return out;
}

/** Growth of $1 in BTC vs S&P 500 total return from first overlapping close. */
export function dollarGrowthSeries(): VsPoint[] {
  const spx = assetSeries("spx");
  const btc = HISTORY.filter((row) => row.usd > 0);
  if (spx.length === 0 || btc.length === 0) return [];
  const t0 = Math.max(spx[0]!.t, btc[0]!.t);
  const btc0 = lookup(btc, t0);
  const spx0 = lookup(spx, t0);
  if (!btc0 || !spx0) return [];
  const out: VsPoint[] = [];
  for (const row of btc) {
    if (row.t < t0) continue;
    if (out.length > 0 && row.t - out[out.length - 1]!.t < 10) continue;
    const s = lookup(spx, row.t);
    if (!s) continue;
    const iso = isoFromDay(row.t);
    out.push({
      t: row.t,
      year: Number(iso.slice(0, 4)) + (Number(iso.slice(5, 7)) - 1) / 12,
      btc: row.usd / btc0,
      spx: s / spx0,
    });
  }
  const lastBtc = btc[btc.length - 1]!;
  const lastSpx = lookup(spx, lastBtc.t);
  if (lastSpx && (out.length === 0 || out[out.length - 1]!.t !== lastBtc.t)) {
    const iso = isoFromDay(lastBtc.t);
    out.push({
      t: lastBtc.t,
      year: Number(iso.slice(0, 4)) + (Number(iso.slice(5, 7)) - 1) / 12,
      btc: lastBtc.usd / btc0,
      spx: lastSpx / spx0,
    });
  }
  return out;
}

export function nearestPoint(series: VsPoint[], t: number): VsPoint | null {
  if (series.length === 0) return null;
  let best = series[0]!;
  let bestD = Math.abs(best.t - t);
  for (const pt of series) {
    const d = Math.abs(pt.t - t);
    if (d < bestD) {
      best = pt;
      bestD = d;
    }
  }
  return best;
}

export function crossoverT(): number {
  const target = 1 + SPX_LONG_RUN;
  let lo = 2000;
  let hi = 80_000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (1 + powerLawOneYearReturn(mid) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function formatReturnPct(v: number): string {
  if (!Number.isFinite(v)) return "\u2014";
  return `${(v * 100).toLocaleString("en-CA", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}

export function formatMultiple(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "\u2014";
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("en-CA", { maximumFractionDigits: 1 })} million\u00d7`;
  if (v >= 1_000) return `${v.toLocaleString("en-CA", { maximumFractionDigits: 0 })}\u00d7`;
  return `${v.toLocaleString("en-CA", { maximumFractionDigits: 1 })}\u00d7`;
}

export function formatAxisMultiple(v: number): string {
  if (!(v > 0)) return "\u2014";
  const e = Math.round(Math.log10(v));
  if (e >= 6) return `${10 ** (e - 6)}M\u00d7`;
  if (e >= 3) return `${10 ** (e - 3)}k\u00d7`;
  return `${10 ** e}\u00d7`;
}

export function formatCapTrillions(usd: number): string {
  const t = usd / 1e12;
  const n = t >= 10 ? Math.round(t) : Number(t.toFixed(1));
  return `$${n}T`;
}
