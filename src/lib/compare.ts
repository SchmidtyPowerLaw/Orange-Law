import raw from "@/data/compare-assets.json";

export type AssetId = "spx" | "tsx" | "cnq" | "nvda" | "aapl" | "cost" | "eth" | "xrp";

export type CompareAsset = {
  id: AssetId;
  label: string;
  hint: string;
  short: string;
  color: string;
};

export const COMPARE_ASSETS: readonly CompareAsset[] = [
  { id: "spx", label: "S&P 500", hint: "incl. dividends", short: "SPX", color: "var(--color-asset-spx)" },
  { id: "tsx", label: "S&P/TSX", hint: "incl. dividends", short: "TSX", color: "var(--color-asset-tsx)" },
  { id: "cnq", label: "Canadian Natural", hint: "incl. distributions", short: "CNQ", color: "var(--color-asset-cnq)" },
  { id: "nvda", label: "NVIDIA", hint: "adj. close", short: "NVDA", color: "var(--color-asset-nvda)" },
  { id: "aapl", label: "Apple", hint: "adj. close", short: "AAPL", color: "var(--color-asset-aapl)" },
  { id: "cost", label: "Costco", hint: "adj. close", short: "COST", color: "var(--color-asset-cost)" },
  { id: "eth", label: "Ethereum", hint: "USD close", short: "ETH", color: "var(--color-asset-eth)" },
  { id: "xrp", label: "XRP", hint: "USD close", short: "XRP", color: "var(--color-asset-xrp)" },
] as const;

export const ASSET_IDS = COMPARE_ASSETS.map((asset) => asset.id);

type FileShape = {
  source: string;
  assets: Record<string, { ticker: string; native: string; note: string; rows: number[][] }>;
};

const file = raw as FileShape;
export const COMPARE_SOURCE = file.source;

export type AssetPoint = { t: number; usd: number };

const SERIES: Record<AssetId, AssetPoint[]> = {
  spx: [],
  tsx: [],
  cnq: [],
  nvda: [],
  aapl: [],
  cost: [],
  eth: [],
  xrp: [],
};

for (const asset of COMPARE_ASSETS) {
  const rows = file.assets[asset.id]?.rows ?? [];
  SERIES[asset.id] = rows
    .filter((row) => row.length >= 2 && row[1] > 0)
    .map(([t, usd]) => ({ t, usd }));
}

export function isAssetId(value: string): value is AssetId {
  return (ASSET_IDS as string[]).includes(value);
}

export function sanitizeAssetIds(ids: unknown): AssetId[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<AssetId>();
  const out: AssetId[] = [];
  for (const item of ids) {
    if (typeof item !== "string" || !isAssetId(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function assetSeries(id: AssetId): AssetPoint[] {
  return SERIES[id];
}

export function assetMeta(id: AssetId): CompareAsset {
  return COMPARE_ASSETS.find((asset) => asset.id === id) ?? COMPARE_ASSETS[0];
}

/** Growth of $1 in the asset, scaled so it equals bitcoin at the first overlap in [tMin, tMax]. */
export function indexAssetToBitcoin(
  series: AssetPoint[],
  tMin: number,
  tMax: number,
  btcAt: (t: number) => number,
  unitScale: (t: number) => number,
): { t: number; value: number }[] {
  const inView: AssetPoint[] = [];
  for (const pt of series) {
    if (pt.t < tMin || pt.t > tMax || pt.usd <= 0) continue;
    inView.push(pt);
  }
  if (inView.length === 0) return [];
  const start = inView[0];
  const asset0 = start.usd * unitScale(start.t);
  const btc0 = btcAt(start.t);
  if (asset0 <= 0 || btc0 <= 0) return [];
  const k = btc0 / asset0;
  return inView.map((pt) => ({ t: pt.t, value: pt.usd * unitScale(pt.t) * k }));
}

export function valueAtTime(points: { t: number; value: number }[], t: number): number | null {
  if (points.length === 0) return null;
  if (t <= points[0].t) return points[0].value;
  if (t >= points[points.length - 1].t) return points[points.length - 1].value;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return points[lo].value;
}

export function totalReturn(start: number, end: number): number {
  if (!(start > 0) || !(end > 0)) return Number.NaN;
  return end / start - 1;
}
