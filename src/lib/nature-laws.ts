export type NatureLawId = "pareto" | "zipf" | "gr" | "cities" | "kleiber" | "btc";

export type NaturePoint = { x: number; y: number };

export type NatureLaw = {
  id: NatureLawId;
  name: string;
  short: string;
  line1: string;
  line2: string;
  formula: string;
  exponent: number;
  exponentLabel: string;
  intercept: number;
  xName: string;
  yName: string;
  color: string;
  citation: string;
};

/**
 * Canonical power laws, using the scaling form y = A x^β on log-log axes.
 *
 * Exponents from the source papers, not curve-fits of this chart:
 * - Pareto α = 1.5 (Pareto 1896–97; CCDF P(X≥x) ∝ x^{-α})
 * - Zipf s = 1 (Zipf 1949)
 * - Gutenberg–Richter as energy: N(≥E) ∝ E^{-b/1.5} with b ≈ 1
 *   (Gutenberg & Richter 1944; Kanamori 1977, log10 E = 1.5 M + const)
 * - City rank-size q = 1 (Auerbach 1913; Zipf 1949; Gabaix AER 1999)
 * - Kleiber β = 3/4 (Kleiber 1932; West, Brown & Enquist, Science 1997)
 * - Bitcoin address balances: on-chain Pareto α ≈ 1.07 (Santostasi & Perrenod;
 *   Kondor et al. 2014: power-law tail, stretched exponential in the bulk)
 *
 * Zipf, city rank-size, and Bitcoin’s wealth tail sit near β = −1; they are
 * drawn with different intercepts so the lines stay distinct.
 */
export const NATURE_LAWS: NatureLaw[] = [
  {
    id: "pareto",
    name: "Income & Wealth (Pareto's law)",
    short: "Pareto",
    line1: "Income & Wealth",
    line2: "(Pareto's law)",
    formula: "P(X ≥ x) = (xₘ / x)^α",
    exponent: -1.5,
    exponentLabel: "α = 1.5",
    intercept: 1,
    xName: "income / wealth x",
    yName: "P(X ≥ x)",
    color: "#7eb6ff",
    citation: "Pareto, Cours d’économie politique (1896–97)",
  },
  {
    id: "zipf",
    name: "Word Use Frequencies (Zipf's law)",
    short: "Zipf",
    line1: "Word Use Frequencies",
    line2: "(Zipf's law)",
    formula: "f(r) ∝ r^{−s}",
    exponent: -1,
    exponentLabel: "s = 1",
    intercept: 1,
    xName: "word rank r",
    yName: "frequency f",
    color: "#e8c547",
    citation: "Zipf, Human Behavior and the Principle of Least Effort (1949)",
  },
  {
    id: "gr",
    name: "Earthquake Size & Frequency (Richter)",
    short: "Richter",
    line1: "Earthquake Size & Frequency",
    line2: "(Richter)",
    formula: "N(≥ E) ∝ E^{−2/3}",
    exponent: -2 / 3,
    exponentLabel: "β = 2/3",
    intercept: 1,
    xName: "seismic energy E",
    yName: "N(≥ E)",
    color: "#4dff9a",
    citation: "Gutenberg & Richter 1944; Kanamori 1977 (E ∝ 10^{1.5 M})",
  },
  {
    id: "cities",
    name: "City Population Sizes (Auerbach-Zipf law)",
    short: "Cities",
    line1: "City Population Sizes",
    line2: "(Auerbach-Zipf law)",
    formula: "S(r) = S₁ / r^q",
    exponent: -1,
    exponentLabel: "q = 1",
    intercept: 6,
    xName: "city rank r",
    yName: "population S",
    color: "#d46bff",
    citation: "Auerbach 1913; Zipf 1949; Gabaix, AER 1999",
  },
  {
    id: "kleiber",
    name: "Animal Metabolic Rates (Kleiber's Law)",
    short: "Kleiber",
    line1: "Animal Metabolic Rates",
    line2: "(Kleiber's Law)",
    formula: "B = B₀ M^{3/4}",
    exponent: 0.75,
    exponentLabel: "β = 3/4",
    intercept: 1,
    xName: "body mass M",
    yName: "metabolic rate B",
    color: "#3ee8ff",
    citation: "Kleiber 1932; West, Brown & Enquist, Science 1997",
  },
  {
    id: "btc",
    name: "Bitcoin Wallet Balances (on-chain Pareto)",
    short: "Bitcoin",
    line1: "Bitcoin Wallet Balances",
    line2: "(on-chain Pareto)",
    formula: "N(≥ x) ∝ x^{−α}",
    exponent: -1.07,
    exponentLabel: "α = 1.07",
    intercept: 2.4,
    xName: "address balance x",
    yName: "N(≥ x)",
    color: "#ff5a12",
    citation:
      "Kondor et al., PLOS ONE 2014 (power-law tail); Santostasi & Perrenod on-chain α ≈ 1.07; rank-size slope ≈ −1 (Santostasi 2025)",
  },
];

export const NATURE_X_MIN = 1;
export const NATURE_X_MAX = 1_000_000;

export function natureSeries(law: NatureLaw, samples = 96): NaturePoint[] {
  const l0 = Math.log10(NATURE_X_MIN);
  const l1 = Math.log10(NATURE_X_MAX);
  const pts: NaturePoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = 10 ** (l0 + (i / samples) * (l1 - l0));
    const y = law.intercept * x ** law.exponent;
    if (y > 0 && Number.isFinite(y)) pts.push({ x, y });
  }
  return pts;
}

export function naturePath(points: NaturePoint[], xAt: (x: number) => number, yAt: (y: number) => number): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(p.x).toFixed(2)} ${yAt(p.y).toFixed(2)}`)
    .join(" ");
}
