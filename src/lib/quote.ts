import { createServerFn } from "@tanstack/react-start";
import { goldUsdAt, HISTORY, type LiveQuote } from "@/lib/history";
import { daysSinceGenesis, GENESIS_UTC, isoFromDay, MS_PER_DAY } from "@/lib/powerlaw";
import { OTHER_CODES, lastHistFx, type OtherCode } from "@/lib/fx";

const UA = { accept: "application/json", "user-agent": "OrangeLaw/1.0" };

async function fetchJson(url: string, timeoutMs = 7000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: UA });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function tryJson(url: string, timeoutMs = 5000): Promise<unknown | null> {
  try {
    return await fetchJson(url, timeoutMs);
  } catch {
    return null;
  }
}

async function goldUsd(): Promise<number> {
  const gold = (await tryJson("https://api.gold-api.com/price/XAU")) as { price?: number } | null;
  if (gold?.price && gold.price > 0) return gold.price;
  const pax = (await tryJson(
    "https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd",
  )) as { "pax-gold"?: { usd?: number } } | null;
  const px = pax?.["pax-gold"]?.usd;
  if (px && px > 0) return px;
  return 0;
}

/** Last GC=F print and the previous completed UTC daily close. */
async function yahooGoldSession(): Promise<{ last: number; prev: number } | null> {
  const y = (await tryJson(
    "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1mo",
    4000,
  )) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
    };
  } | null;
  const res = y?.chart?.result?.[0];
  const ts = res?.timestamp;
  const close = res?.indicators?.quote?.[0]?.close;
  if (!ts || !close || ts.length === 0) return null;
  const bars: Array<{ day: string; close: number }> = [];
  for (let i = 0; i < ts.length; i++) {
    const c = Number(close[i]);
    if (!(c > 0)) continue;
    const day = new Date(ts[i]! * 1000).toISOString().slice(0, 10);
    const last = bars[bars.length - 1];
    if (last && last.day === day) last.close = c;
    else bars.push({ day, close: c });
  }
  if (bars.length === 0) return null;
  const yahooLast = bars[bars.length - 1]!.close;
  const today = new Date().toISOString().slice(0, 10);
  let yahooPrev = yahooLast;
  for (let i = bars.length - 1; i >= 0; i--) {
    if (bars[i]!.day < today) {
      yahooPrev = bars[i]!.close;
      break;
    }
  }
  return { last: yahooLast, prev: yahooPrev };
}

async function coinbaseSpot(pair: string): Promise<number> {
  const cb = (await tryJson(`https://api.coinbase.com/v2/prices/${pair}/spot`, 4000)) as {
    data?: { amount?: string };
  } | null;
  const n = Number(cb?.data?.amount);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function krakenLast(pair: string): Promise<number> {
  const kr = (await tryJson(`https://api.kraken.com/0/public/Ticker?pair=${pair}`, 4000)) as {
    result?: Record<string, { c?: string[] }>;
  } | null;
  const row = kr?.result ? Object.values(kr.result)[0] : undefined;
  const n = Number(row?.c?.[0]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function spotUsd(): Promise<number> {
  // Prefer actual USD (Coinbase / Kraken). Binance BTCUSDT is tether, not dollars.
  const cb = await coinbaseSpot("BTC-USD");
  if (cb > 0) return cb;
  const kr = await krakenLast("XXBTZUSD");
  if (kr > 0) return kr;
  const binance = (await tryJson(
    "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
    4000,
  )) as { price?: string } | null;
  const b = Number(binance?.price);
  if (Number.isFinite(b) && b > 0) return b;
  const cg = (await tryJson(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    5000,
  )) as { bitcoin?: { usd?: number } } | null;
  const g = cg?.bitcoin?.usd;
  if (g && g > 0) return g;
  throw new Error("spot missing");
}

async function spotCad(): Promise<number> {
  const cb = await coinbaseSpot("BTC-CAD");
  if (cb > 0) return cb;
  return krakenLast("XXBTZCAD");
}

async function krakenPrevClose(pair: string): Promise<number | null> {
  const ohlc = (await tryJson(
    `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=1440`,
    4000,
  )) as { result?: Record<string, unknown> } | null;
  const rows = ohlc?.result
    ? Object.values(ohlc.result).find((value) => Array.isArray(value))
    : null;
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const prev = rows[rows.length - 2] as unknown;
  const close = Array.isArray(prev) ? Number(prev[4]) : NaN;
  return Number.isFinite(close) && close > 0 ? close : null;
}

/** Previous completed UTC daily close. */
async function coinbasePrevClose(product: string): Promise<number | null> {
  const candles = (await tryJson(
    `https://api.exchange.coinbase.com/products/${product}/candles?granularity=86400`,
    4000,
  )) as unknown;
  if (Array.isArray(candles) && candles.length >= 2) {
    const yesterday = candles[1] as unknown;
    const close = Array.isArray(yesterday) ? Number(yesterday[4]) : NaN;
    if (Number.isFinite(close) && close > 0) return close;
  }
  return null;
}

async function btcPrevUtcCloseUsd(): Promise<number | null> {
  const cb = await coinbasePrevClose("BTC-USD");
  if (cb && cb > 0) return cb;
  const kr = await krakenPrevClose("XXBTZUSD");
  if (kr && kr > 0) return kr;
  const klines = (await tryJson(
    "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=2",
    4000,
  )) as unknown;
  if (Array.isArray(klines) && klines.length >= 2) {
    const candle = klines[klines.length - 2] as unknown;
    const close = Array.isArray(candle) ? Number(candle[4]) : NaN;
    if (Number.isFinite(close) && close > 0) return close;
  }
  return null;
}

async function btcPrevUtcCloseCad(): Promise<number | null> {
  const cb = await coinbasePrevClose("BTC-CAD");
  if (cb && cb > 0) return cb;
  return krakenPrevClose("XXBTZCAD");
}

function withPrevClose(
  quote: Omit<LiveQuote, "prevUsd" | "prevCad" | "prevXau">,
  prevUsd: number | null,
  prevCad: number | null,
  prevFx: number,
  prevGold: number,
): LiveQuote {
  const prev = prevUsd && prevUsd > 0 ? prevUsd : 0;
  const fxY = prevFx > 0 ? prevFx : quote.fx;
  const goldY = prevGold > 0 ? prevGold : quote.xau;
  const cadY = prevCad && prevCad > 0 ? prevCad : prev > 0 && fxY > 0 ? prev * fxY : 0;
  return {
    ...quote,
    prevUsd: prev,
    prevCad: cadY,
    prevXau: prev > 0 && goldY > 0 ? prev / goldY : 0,
    fxOther: quote.fxOther ?? {},
  };
}

async function liveOtherFx(): Promise<Partial<Record<OtherCode, number>>> {
  const json = (await tryJson("https://open.er-api.com/v6/latest/USD", 4000)) as {
    rates?: Record<string, number>;
  } | null;
  const rates = json?.rates ?? {};
  const out: Partial<Record<OtherCode, number>> = {};
  for (const code of OTHER_CODES) {
    const n = Number(rates[code]);
    if (Number.isFinite(n) && n > 0) out[code] = n;
    else out[code] = lastHistFx(code);
  }
  return out;
}

async function coinbaseDailyCloses(startSec: number, endSec: number): Promise<Map<number, number>> {
  const start = new Date(startSec * 1000).toISOString();
  const end = new Date(endSec * 1000).toISOString();
  const candles = (await tryJson(
    `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    6000,
  )) as unknown;
  const map = new Map<number, number>();
  if (!Array.isArray(candles)) return map;
  for (const candle of candles) {
    if (!Array.isArray(candle)) continue;
    const sec = Number(candle[0]);
    const close = Number(candle[4]);
    if (!(close > 0) || !Number.isFinite(sec)) continue;
    map.set(Math.round((sec * 1000 - GENESIS_UTC) / MS_PER_DAY), close);
  }
  return map;
}

async function krakenDailyCloses(startSec: number): Promise<Map<number, number>> {
  const ohlc = (await tryJson(
    `https://api.kraken.com/0/public/OHLC?pair=XXBTZUSD&interval=1440&since=${startSec}`,
    6000,
  )) as { result?: Record<string, unknown> } | null;
  const rows = ohlc?.result
    ? Object.values(ohlc.result).find((value) => Array.isArray(value))
    : null;
  const map = new Map<number, number>();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const sec = Number(row[0]);
    const close = Number(row[4]);
    if (!(close > 0) || !Number.isFinite(sec)) continue;
    map.set(Math.round((sec * 1000 - GENESIS_UTC) / MS_PER_DAY), close);
  }
  return map;
}

/** Completed UTC-day USD closes. Today is excluded — that print stays live. */
async function usdClosesBetween(startT: number, endT: number): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  for (let t = startT; t <= endT; t += 280) {
    const chunkEnd = Math.min(endT, t + 279);
    const startSec = Math.floor((GENESIS_UTC + t * MS_PER_DAY) / 1000) - 3600;
    const endSec = Math.floor((GENESIS_UTC + (chunkEnd + 1) * MS_PER_DAY) / 1000) + 3600;
    const part = await coinbaseDailyCloses(startSec, endSec);
    for (const [k, v] of part) map.set(k, v);
  }
  if (map.size > 0) return map;
  const startSec = Math.floor((GENESIS_UTC + startT * MS_PER_DAY) / 1000) - 3600;
  return krakenDailyCloses(startSec);
}

async function bocFxFrom(startIso: string): Promise<Array<{ iso: string; fx: number }>> {
  const json = (await tryJson(
    `https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?start_date=${startIso}`,
    6000,
  )) as { observations?: Array<{ d?: string; FXUSDCAD?: { v?: string } }> } | null;
  const out: Array<{ iso: string; fx: number }> = [];
  for (const obs of json?.observations ?? []) {
    const fx = Number(obs.FXUSDCAD?.v);
    if (obs.d && Number.isFinite(fx) && fx > 0) out.push({ iso: obs.d, fx });
  }
  out.sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));
  return out;
}

function fxOnOrBefore(iso: string, series: Array<{ iso: string; fx: number }>, fallback: number): number {
  let fx = fallback;
  for (const row of series) {
    if (row.iso <= iso) fx = row.fx;
    else break;
  }
  return fx;
}

/** Daily prints the bundled file does not have yet, through yesterday UTC. */
async function completedGap(): Promise<LiveQuote["gap"]> {
  const last = HISTORY[HISTORY.length - 1];
  const today = daysSinceGenesis();
  if (!last || today <= last.t) return [];
  const startT = Math.round(last.t) + 1;
  const endT = today - 1;
  if (endT < startT) return [];
  const fallbackFx = last.usd > 0 && last.cad > 0 ? last.cad / last.usd : 1.38;
  const [usdMap, fxSeries] = await Promise.all([
    usdClosesBetween(startT, endT),
    bocFxFrom(isoFromDay(Math.max(0, Math.round(last.t) - 7))),
  ]);
  const gap: LiveQuote["gap"] = [];
  for (let t = startT; t <= endT; t++) {
    const usdRaw = usdMap.get(t);
    if (!(usdRaw && usdRaw > 0)) continue;
    const fx = fxOnOrBefore(isoFromDay(t), fxSeries, fallbackFx);
    const usd = Math.round(usdRaw * 100) / 100;
    const cad = Math.round(usd * fx * 100) / 100;
    gap.push({ t, usd, cad });
  }
  return gap;
}

async function assembleQuote(): Promise<LiveQuote> {
  const [usd, cadNative, boc, xau, prevKline, prevCadNative, goldSession, fxOther, gap] = await Promise.all([
    spotUsd(),
    spotCad(),
    tryJson("https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=5"),
    goldUsd(),
    btcPrevUtcCloseUsd(),
    btcPrevUtcCloseCad(),
    yahooGoldSession(),
    liveOtherFx(),
    completedGap().catch(() => [] as LiveQuote["gap"]),
  ]);
  const bocObs =
    (boc as { observations?: Array<{ d?: string; FXUSDCAD?: { v?: string } }> } | null)
      ?.observations ?? [];
  const bocFx = Number(bocObs[0]?.FXUSDCAD?.v);
  const bocFxPrev = Number(bocObs[1]?.FXUSDCAD?.v);
  const fxFromCad = cadNative > 0 && usd > 0 ? cadNative / usd : 0;
  const fx =
    fxFromCad > 0
      ? fxFromCad
      : Number.isFinite(bocFx) && bocFx > 0
        ? bocFx
        : 1.38;
  const cad = cadNative > 0 ? cadNative : usd * fx;
  const prevFx = Number.isFinite(bocFxPrev) && bocFxPrev > 0 ? bocFxPrev : fx;
  // Apply today's COMEX move onto live spot so a stale gold-history.json
  // cannot dump several sessions into "today".
  let prevGold = goldUsdAt(daysSinceGenesis() - 1);
  if (xau > 0 && goldSession && goldSession.last > 0 && goldSession.prev > 0) {
    prevGold = xau * (goldSession.prev / goldSession.last);
  }
  return withPrevClose(
    {
      usd,
      cad,
      fx,
      xau,
      fxOther,
      gap,
      asOf: new Date().toISOString(),
      source: "Coinbase/Kraken",
    },
    prevKline,
    prevCadNative,
    prevFx,
    prevGold,
  );
}

export type LiveTick = { usd: number; cad: number; xau: number };

export const getLiveTick = createServerFn({ method: "POST" }).handler(
  async (): Promise<LiveTick> => {
    const [usd, cad, xau] = await Promise.all([spotUsd(), spotCad(), goldUsd()]);
    return { usd, cad, xau };
  },
);

export const getLiveBtcUsd = createServerFn({ method: "POST" }).handler(
  async (): Promise<number> => spotUsd(),
);

export const getLiveQuote = createServerFn({ method: "POST" }).handler(
  async (): Promise<LiveQuote> => assembleQuote(),
);
