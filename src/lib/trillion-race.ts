import { HISTORY } from "@/lib/history";
import raceMcaps from "@/data/race-mcaps.json";

export type RacePoint = { t: number; mcap: number };

export type RaceHorse = {
  id: string;
  name: string;
  years: number;
  yearsLabel: string;
  color: string;
  founded: string;
  logo?: string;
  points: RacePoint[];
};

const TRILLION = 1_000_000_000_000;

function btcSupply(tDays: number): number {
  let blocks = Math.max(0, tDays * 144);
  let supply = 0;
  let subsidy = 50;
  for (let era = 0; era < 10 && blocks > 0; era++) {
    const take = Math.min(blocks, 210_000);
    supply += take * subsidy;
    blocks -= take;
    subsidy /= 2;
  }
  return supply;
}

function downsample(points: RacePoint[], maxN: number): RacePoint[] {
  if (points.length <= maxN) return points;
  const step = (points.length - 1) / (maxN - 1);
  const out: RacePoint[] = [];
  for (let i = 0; i < maxN - 1; i++) out.push(points[Math.round(i * step)]!);
  out.push(points[points.length - 1]!);
  return out;
}

function bitcoinPoints(): RacePoint[] {
  const pts: RacePoint[] = [];
  for (const row of HISTORY) {
    if (!(row.usd > 0)) continue;
    const mcap = row.usd * btcSupply(row.t);
    if (!(mcap > 0)) continue;
    pts.push({ t: row.t / 365.25, mcap });
    if (mcap >= TRILLION) break;
  }
  if (pts.length === 0) return pts;
  const last = pts[pts.length - 1]!;
  if (last.mcap < TRILLION) pts.push({ t: last.t, mcap: TRILLION });
  else pts[pts.length - 1] = { t: last.t, mcap: TRILLION };
  return downsample(pts, 240);
}

function fromQuarterly(id: keyof typeof raceMcaps): RacePoint[] {
  const rows = raceMcaps[id] as [number, number][];
  return rows.map(([t, mcap]) => ({ t, mcap }));
}

export const RACE_HORSES: RaceHorse[] = [
  {
    id: "btc",
    name: "Bitcoin",
    years: 12,
    yearsLabel: "12 years",
    color: "#ff5a12",
    founded: "Genesis 2009",
    logo: "/race/bitcoin.png",
    points: bitcoinPoints(),
  },
  {
    id: "meta",
    name: "Meta",
    years: 17.4,
    yearsLabel: "17.4 years",
    color: "#4d8dff",
    founded: "Founded 2004",
    logo: "/race/meta.png",
    points: fromQuarterly("meta"),
  },
  {
    id: "tesla",
    name: "Tesla",
    years: 18.3,
    yearsLabel: "18.3 years",
    color: "#d8d8d8",
    founded: "Founded 2003",
    logo: "/race/tesla.png",
    points: fromQuarterly("tesla"),
  },
  {
    id: "google",
    name: "Google",
    years: 21.4,
    yearsLabel: "21.4 years",
    color: "#e8c547",
    founded: "Founded 1998",
    logo: "/race/google.png",
    points: fromQuarterly("google"),
  },
  {
    id: "amazon",
    name: "Amazon",
    years: 24.2,
    yearsLabel: "24.2 years",
    color: "#c84bff",
    founded: "Founded 1994",
    logo: "/race/amazon.png",
    points: fromQuarterly("amazon"),
  },
  {
    id: "nvidia",
    name: "NVIDIA",
    years: 30.1,
    yearsLabel: "30.1 years",
    color: "#76b900",
    founded: "Founded 1993",
    logo: "/race/nvidia.png",
    points: fromQuarterly("nvidia"),
  },
  {
    id: "apple",
    name: "Apple",
    years: 42.3,
    yearsLabel: "42.3 years",
    color: "#ff2d2d",
    founded: "Founded 1976",
    logo: "/race/apple.png",
    points: fromQuarterly("apple"),
  },
  {
    id: "msft",
    name: "Microsoft",
    years: 44.1,
    yearsLabel: "44.1 years",
    color: "#7ec8ff",
    founded: "Founded 1975",
    logo: "/race/microsoft.png",
    points: fromQuarterly("msft"),
  },
];

export const RACE_X_MAX = 46;
export const RACE_Y_MIN = 1_000_000;
export const RACE_Y_MAX = 4_000_000_000_000;
export const RACE_TRILLION = TRILLION;

export function racePath(
  points: RacePoint[],
  xAt: (t: number) => number,
  yAt: (mcap: number) => number,
): string {
  return points
    .filter((p) => p.mcap >= RACE_Y_MIN)
    .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(p.t).toFixed(2)} ${yAt(p.mcap).toFixed(2)}`)
    .join(" ");
}

export function moneyTick(v: number): string {
  if (v >= 1e12) return `$${Math.round(v / 1e12)}T`;
  if (v >= 1e9) return `$${Math.round(v / 1e9)}B`;
  if (v >= 1e6) return `$${Math.round(v / 1e6)}M`;
  return `$${v}`;
}
