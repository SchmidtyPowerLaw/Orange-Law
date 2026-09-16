import { HISTORY } from "@/lib/history";

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

function fromKnots(knots: Array<[number, number]>): RacePoint[] {
  const pts: RacePoint[] = [];
  for (let i = 0; i < knots.length - 1; i++) {
    const [t0, y0] = knots[i]!;
    const [t1, y1] = knots[i + 1]!;
    const n = Math.max(6, Math.round((t1 - t0) * 8));
    for (let k = 0; k < n; k++) {
      const u = k / n;
      pts.push({
        t: t0 + u * (t1 - t0),
        mcap: 10 ** (Math.log10(y0) + u * (Math.log10(y1) - Math.log10(y0))),
      });
    }
  }
  const end = knots[knots.length - 1]!;
  pts.push({ t: end[0], mcap: end[1] });
  return pts;
}

const B = 1_000_000_000;

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
    points: fromKnots([
      [8.4, 80 * B],
      [10, 200 * B],
      [12, 330 * B],
      [13.5, 520 * B],
      [15, 480 * B],
      [17.4, TRILLION],
    ]),
  },
  {
    id: "tesla",
    name: "Tesla",
    years: 18.3,
    yearsLabel: "18.3 years",
    color: "#d8d8d8",
    founded: "Founded 2003",
    logo: "/race/tesla.png",
    points: fromKnots([
      [7.3, 1.6 * B],
      [10, 15 * B],
      [13, 30 * B],
      [16, 75 * B],
      [17.2, 250 * B],
      [17.8, 650 * B],
      [18.3, TRILLION],
    ]),
  },
  {
    id: "google",
    name: "Google",
    years: 21.4,
    yearsLabel: "21.4 years",
    color: "#e8c547",
    founded: "Founded 1998",
    logo: "/race/google.png",
    points: fromKnots([
      [6.3, 23 * B],
      [9, 200 * B],
      [14, 230 * B],
      [17, 370 * B],
      [19.2, 580 * B],
      [21.4, TRILLION],
    ]),
  },
  {
    id: "amazon",
    name: "Amazon",
    years: 24.2,
    yearsLabel: "24.2 years",
    color: "#c84bff",
    founded: "Founded 1994",
    points: fromKnots([
      [3, 0.5 * B],
      [5.4, 28 * B],
      [7, 4 * B],
      [13, 35 * B],
      [16, 80 * B],
      [21, 250 * B],
      [23, 470 * B],
      [24.2, TRILLION],
    ]),
  },
  {
    id: "nvidia",
    name: "NVIDIA",
    years: 30.1,
    yearsLabel: "30.1 years",
    color: "#76b900",
    founded: "Founded 1993",
    logo: "/race/nvidia.png",
    points: fromKnots([
      [6.2, 0.6 * B],
      [9, 1.2 * B],
      [14, 10 * B],
      [23, 32 * B],
      [25, 90 * B],
      [27, 320 * B],
      [29, 260 * B],
      [30.1, TRILLION],
    ]),
  },
  {
    id: "apple",
    name: "Apple",
    years: 42.3,
    yearsLabel: "42.3 years",
    color: "#ff2d2d",
    founded: "Founded 1976",
    logo: "/race/apple.png",
    points: fromKnots([
      [4.6, 1.8 * B],
      [7, 5 * B],
      [16, 7 * B],
      [21, 2.5 * B],
      [25, 8 * B],
      [31, 75 * B],
      [34, 200 * B],
      [36, 500 * B],
      [39, 650 * B],
      [42.3, TRILLION],
    ]),
  },
  {
    id: "msft",
    name: "Microsoft",
    years: 44.1,
    yearsLabel: "44.1 years",
    color: "#7ec8ff",
    founded: "Founded 1975",
    logo: "/race/microsoft.png",
    points: fromKnots([
      [11.2, 0.78 * B],
      [15, 8 * B],
      [20, 50 * B],
      [23, 270 * B],
      [24.5, 600 * B],
      [27, 270 * B],
      [34, 220 * B],
      [39, 360 * B],
      [43, 780 * B],
      [44.1, TRILLION],
    ]),
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
