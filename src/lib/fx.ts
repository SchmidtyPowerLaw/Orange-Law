import raw from "@/data/fx-history.json";

export const OTHER_CODES = [
  "AED",
  "IQD",
  "EUR",
  "TRY",
  "VND",
  "BRL",
  "INR",
  "UAH",
  "NGN",
  "MXN",
  "PHP",
  "THB",
  "JPY",
  "CNY",
] as const;

export type OtherCode = (typeof OTHER_CODES)[number];

export type OtherCurrencyOption = {
  value: OtherCode;
  label: string;
  name: string;
  hint: string;
};

export const OTHER_CURRENCY_OPTIONS: readonly OtherCurrencyOption[] = [
  { value: "AED", label: "AED", name: "UAE Dirham", hint: "United Arab Emirates" },
  { value: "IQD", label: "IQD", name: "Iraqi Dinar", hint: "Iraq" },
  { value: "EUR", label: "EUR", name: "Euro", hint: "Euro area" },
  { value: "TRY", label: "TRY", name: "Turkish Lira", hint: "Türkiye" },
  { value: "VND", label: "VND", name: "Vietnamese Dong", hint: "Vietnam" },
  { value: "BRL", label: "BRL", name: "Brazilian Real", hint: "Brazil" },
  { value: "INR", label: "INR", name: "Indian Rupee", hint: "India" },
  { value: "UAH", label: "UAH", name: "Ukrainian Hryvnia", hint: "Ukraine" },
  { value: "NGN", label: "NGN", name: "Nigerian Naira", hint: "Nigeria" },
  { value: "MXN", label: "MXN", name: "Mexican Peso", hint: "Mexico" },
  { value: "PHP", label: "PHP", name: "Philippine Peso", hint: "Philippines" },
  { value: "THB", label: "THB", name: "Thai Baht", hint: "Thailand" },
  { value: "JPY", label: "JPY", name: "Japanese Yen", hint: "Japan" },
  { value: "CNY", label: "CNY", name: "Chinese Yuan", hint: "China" },
] as const;

export function isOtherCode(value: unknown): value is OtherCode {
  return typeof value === "string" && (OTHER_CODES as readonly string[]).includes(value);
}

type FileShape = {
  source: string;
  unit: string;
  series: Record<string, number[][]>;
};

const file = raw as FileShape;
export const FX_SOURCE = file.source;

const TABLES: Record<OtherCode, Array<[number, number]>> = {
  AED: [],
  IQD: [],
  EUR: [],
  TRY: [],
  VND: [],
  BRL: [],
  INR: [],
  UAH: [],
  NGN: [],
  MXN: [],
  PHP: [],
  THB: [],
  JPY: [],
  CNY: [],
};

for (const code of OTHER_CODES) {
  const rows = file.series[code] ?? [];
  TABLES[code] = rows
    .filter((row) => row.length >= 2 && row[1] > 0)
    .map((row) => [row[0], row[1]]);
}

function lookup(rows: Array<[number, number]>, t: number, fallback: number): number {
  if (rows.length === 0) return fallback;
  if (t <= rows[0][0]) return rows[0][1];
  let lo = 0;
  let hi = rows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (rows[mid][0] <= t) lo = mid;
    else hi = mid - 1;
  }
  return rows[lo][1];
}

const LAST_FX: Record<OtherCode, number> = {
  AED: 3.6725,
  IQD: 1310,
  EUR: 0.87,
  TRY: 48.7,
  VND: 26000,
  BRL: 5.15,
  INR: 96,
  UAH: 44.6,
  NGN: 1325,
  MXN: 17.24,
  PHP: 62.75,
  THB: 33.39,
  JPY: 156.1,
  CNY: 6.71,
};

/** Local units per 1 USD on that day (forward-filled). */
export function fxUsdTo(code: OtherCode, t: number, live?: number): number {
  const rows = TABLES[code];
  const lastT = rows.length ? rows[rows.length - 1][0] : -1;
  if (live && live > 0 && t >= lastT) return live;
  return lookup(rows, t, LAST_FX[code]);
}

export function lastHistFx(code: OtherCode): number {
  const rows = TABLES[code];
  return rows.length ? rows[rows.length - 1][1] : LAST_FX[code];
}
