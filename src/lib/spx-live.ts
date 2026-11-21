import { createServerFn } from "@tanstack/react-start";
import { assetSeries, type AssetPoint } from "@/lib/compare";
import { daysSinceGenesis, GENESIS_UTC, MS_PER_DAY } from "@/lib/powerlaw";

export type SpxPoint = { t: number; usd: number };

function tFromSec(sec: number): number {
  return Math.round((sec * 1000 - GENESIS_UTC) / MS_PER_DAY);
}

async function yahooSpx(startSec: number): Promise<SpxPoint[]> {
  const endSec = Math.floor(Date.now() / 1000) + 86_400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5ESP500TR?interval=1d&period1=${startSec}&period2=${endSec}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: Array<number | null> }> };
        }>;
      };
    };
    const row = json.chart?.result?.[0];
    const ts = row?.timestamp;
    const close = row?.indicators?.quote?.[0]?.close;
    if (!ts || !close) return [];
    const out: SpxPoint[] = [];
    for (let i = 0; i < ts.length; i++) {
      const usd = Number(close[i]);
      const sec = Number(ts[i]);
      if (!(usd > 0) || !Number.isFinite(sec)) continue;
      out.push({ t: tFromSec(sec), usd });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Daily ^SP500TR closes after the bundled file, plus today's close held over a weekend. */
export const getLiveSpx = createServerFn({ method: "GET" }).handler(async (): Promise<SpxPoint[]> => {
  const base = assetSeries("spx");
  const last = base[base.length - 1];
  if (!last) return [];
  const startSec = Math.floor((GENESIS_UTC + (last.t - 7) * MS_PER_DAY) / 1000);
  const live = await yahooSpx(startSec);
  const anchor = live.find((point) => point.t === last.t);
  if (!anchor || Math.abs(anchor.usd / last.usd - 1) > 0.02) return [];
  const extra = live.filter((point) => point.t > last.t);
  if (extra.length === 0) return [];
  const newest = extra[extra.length - 1]!;
  const today = daysSinceGenesis();
  if (today > newest.t) extra.push({ t: today, usd: newest.usd });
  return extra;
});

export function mergeLiveSpx(extra: SpxPoint[] | null | undefined): AssetPoint[] {
  const base = assetSeries("spx");
  if (!extra || extra.length === 0) return base;
  const lastT = base[base.length - 1]?.t ?? -1;
  const add = extra.filter((point) => point.t > lastT && point.usd > 0);
  if (add.length === 0) return base;
  return base.concat(add);
}
