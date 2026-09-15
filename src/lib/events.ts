import { futureEventMarks } from "@/lib/future-path";
import type { Currency } from "@/lib/format";
import { type HistoryRow, priceOf, rowAtT } from "@/lib/history";
import { residualZ, tFromIso } from "@/lib/powerlaw";
import type { PurchaseRow } from "@/lib/purchases";

export type EventTone = "bull" | "bear" | "cheap" | "expensive" | "law";

export type MarketEvent = {
  iso: string;
  label: string;
  tone: EventTone;
  image?: string;
};

export type PlotEvent = MarketEvent & {
  t: number;
  spot: number;
};

/** Peaks, troughs, and the first power-law publication. Keep it short. */
export const MAJOR_EVENTS: readonly MarketEvent[] = [
  { iso: "2011-06-08", label: "First $32 bubble peak", tone: "bull" },
  { iso: "2011-11-18", label: "Crash to $2", tone: "bear" },
  { iso: "2013-11-30", label: "$1k mania peak", tone: "bull" },
  { iso: "2014-02-24", label: "Mt. Gox collapse", tone: "bear" },
  { iso: "2015-01-14", label: "Deep bear bottom", tone: "bear" },
  { iso: "2017-12-17", label: "$20k blow-off top", tone: "bull" },
  { iso: "2018-09-03", label: "Giovanni publishes power law", tone: "law" },
  { iso: "2018-12-15", label: "Crypto winter low", tone: "bear" },
  { iso: "2020-03-12", label: "COVID crash", tone: "bear" },
  { iso: "2021-11-10", label: "$69k cycle high", tone: "bull" },
  { iso: "2022-11-11", label: "FTX collapse", tone: "bear" },
  { iso: "2024-03-14", label: "Spot ETF all-time high", tone: "bull" },
  { iso: "2026-09-10", label: "AI Capital Drain", tone: "bear" },
];

export function eventSitsAbove(tone: EventTone): boolean {
  return tone === "bull" || tone === "expensive" || tone === "law";
}

export function eventStroke(tone: EventTone): string {
  if (tone === "bull" || tone === "cheap") return "var(--color-up)";
  if (tone === "law") return "var(--color-floor)";
  return "var(--color-down)";
}

function toPlotEvent(
  history: HistoryRow[],
  currency: Currency,
  event: MarketEvent,
  liveXau: number,
  liveFx = 0,
): PlotEvent | null {
  const last = history[history.length - 1];
  if (!last) return null;
  const rawT = tFromIso(event.iso);
  if (rawT == null) return null;
  const t = Math.min(rawT, last.t);
  const row = rowAtT(history, t);
  if (!row) return null;
  return {
    ...event,
    t,
    spot: priceOf(row, currency, liveXau, liveFx),
  };
}

export function plotEvents(
  history: HistoryRow[],
  currency: Currency,
  liveXau = 1800,
  liveFx = 0,
): PlotEvent[] {
  const out: PlotEvent[] = [];
  for (const event of MAJOR_EVENTS) {
    const plotted = toPlotEvent(history, currency, event, liveXau, liveFx);
    if (plotted) out.push(plotted);
  }
  return out;
}

/** Lore marks for the Bitcoin History reel — condensed so they fit the path. */
export const GENESIS_STILL = "/history/genesis-troll.jpg";

export const HISTORY_LORE: readonly MarketEvent[] = [
  { iso: "2009-01-03", label: "Genesis troll · Times headline", tone: "law", image: "/history/genesis-troll.jpg" },
  { iso: "2010-07-17", label: "Pizza Day · 10k BTC lunch", tone: "bull", image: "/history/pizza-day.jpg" },
  { iso: "2010-10-26", label: "First obituary. Still not dead", tone: "bear", image: "/history/still-not-dead.jpg" },
  { iso: "2011-05-02", label: "Keiser vs Schiff at $1", tone: "bull", image: "/history/keiser-vs-schiff.jpg" },
  { iso: "2013-08-20", label: "8,000 BTC in a Welsh dump", tone: "bear", image: "/history/welsh-landfill.jpg" },
  { iso: "2013-12-18", label: "“I AM HODLING”", tone: "bull", image: "/history/i-am-hodling.jpg" },
  { iso: "2017-07-13", label: "Sign Guy: BUY BITCOIN", tone: "bull", image: "/history/sign-guy.jpg" },
  { iso: "2017-11-29", label: "McAfee’s $1M wager", tone: "bear", image: "/history/mcafee-wager.jpg" },
  { iso: "2018-05-05", label: "“Rat poison squared”", tone: "bear", image: "/history/rat-poison.jpg" },
  { iso: "2018-09-03", label: "Giovanni publishes power law", tone: "law", image: "/history/giovanni-power-law.jpg" },
  { iso: "2021-06-04", label: "Laser eyes · Miami", tone: "bull", image: "/history/laser-eyes-miami.jpg" },
  { iso: "2021-09-07", label: "El Salvador legal tender", tone: "bull", image: "/history/el-salvador.jpg" },
  { iso: "2024-01-10", label: "Spot ETFs: never → yes", tone: "bull", image: "/history/etf-never.jpg" },
];

export function plotHistoryEvents(
  history: HistoryRow[],
  currency: Currency,
  liveXau = 1800,
  liveFx = 0,
): PlotEvent[] {
  const firstT = history[0]?.t ?? 0;
  const out: PlotEvent[] = [];
  for (const event of HISTORY_LORE) {
    const plotted = toPlotEvent(history, currency, event, liveXau, liveFx);
    if (plotted) out.push({ ...plotted, t: Math.max(plotted.t, firstT) });
  }
  return out;
}

export function plotFutureEvents(
  tNow: number,
  zNow: number,
  fx: number,
): PlotEvent[] {
  if (!(tNow > 0) || !Number.isFinite(zNow) || !(fx > 0)) return [];
  return futureEventMarks(tNow, zNow)
    .filter((mark) => mark.t > tNow + 1)
    .map((mark) => ({
      iso: mark.iso,
      label: mark.label,
      tone: mark.tone,
      t: mark.t,
      spot: mark.usd * fx,
    }));
}

type ScoredBuy = {
  iso: string;
  t: number;
  z: number;
  amount: number;
  spot: number;
};

export function plotBuyExtremes(
  purchases: PurchaseRow[],
  history: HistoryRow[],
  currency: Currency,
  liveXau = 1800,
  liveFx = 0,
): PlotEvent[] {
  const scored: ScoredBuy[] = [];
  for (const row of purchases) {
    const t = tFromIso(row.iso);
    if (t == null) continue;
    const hist = rowAtT(history, t);
    if (!hist || hist.usd <= 0) continue;
    scored.push({
      iso: row.iso,
      t,
      z: residualZ(hist.usd, t),
      amount: row.amount,
      spot: priceOf(hist, currency, liveXau, liveFx),
    });
  }
  if (scored.length === 0) return [];

  const cheaper = (a: ScoredBuy, b: ScoredBuy) => {
    if (b.z < a.z - 1e-6) return b;
    if (a.z < b.z - 1e-6) return a;
    if (b.amount !== a.amount) return b.amount > a.amount ? b : a;
    return b.t < a.t ? b : a;
  };
  const pricier = (a: ScoredBuy, b: ScoredBuy) => {
    if (b.z > a.z + 1e-6) return b;
    if (a.z > b.z + 1e-6) return a;
    if (b.amount !== a.amount) return b.amount > a.amount ? b : a;
    return b.t > a.t ? b : a;
  };

  const cheap = scored.reduce(cheaper);
  const expensive = scored.reduce(pricier);
  const events: PlotEvent[] = [
    { iso: cheap.iso, label: "Cheapest buy", tone: "cheap", t: cheap.t, spot: cheap.spot },
  ];
  if (cheap.iso !== expensive.iso) {
    events.push({
      iso: expensive.iso,
      label: "Most expensive buy",
      tone: "expensive",
      t: expensive.t,
      spot: expensive.spot,
    });
  }
  return events;
}
