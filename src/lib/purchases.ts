import type { Currency, FiatCurrency } from "@/lib/format";
import { type HistoryRow, priceOf, rowAtT } from "@/lib/history";
import { tFromIso } from "@/lib/powerlaw";

export type PurchaseRow = {
  iso: string;
  amount: number;
};

export type PlotBuy = {
  t: number;
  iso: string;
  amount: number;
  btc: number;
  r: number;
  spot: number;
};

const R_MIN = 2.6;
const R_MAX = 6.8;
const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};

function headerLooksLikeDate(key: string): boolean {
  return /date|day|when|time/i.test(key);
}

function headerLooksLikeAmount(key: string): boolean {
  if (headerLooksLikeDate(key)) return false;
  return /amount|dollar|cad|usd|value|bought|spend|cost|fiat|\$/i.test(key);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymdIso(year: number, monthIndex: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) return null;
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  if (year < 2009 || year > 2100) return null;
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, monthIndex, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== monthIndex || dt.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function excelSerialToIso(serial: number, date1904 = false): string | null {
  if (!Number.isFinite(serial)) return null;
  const whole = Math.floor(serial);
  if (whole < 1 || whole > 120000) return null;
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const utc = epoch + whole * 86_400_000;
  const d = new Date(utc);
  return ymdIso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function fromParts(a: number, b: number, c: number): string | null {
  if (c < 100) c += c >= 70 ? 1900 : 2000;
  if (a >= 1000) return ymdIso(a, b - 1, c);
  if (c >= 1000) {
    if (a > 12 && b <= 12) return ymdIso(c, b - 1, a);
    if (b > 12 && a <= 12) return ymdIso(c, a - 1, b);
    const us = ymdIso(c, a - 1, b);
    if (us) return us;
    return ymdIso(c, b - 1, a);
  }
  return null;
}

function parseDateString(raw: string): string | null {
  const trimmed = raw.trim().replace(/^'/, "").replace(/[.\s]+$/, "");
  if (!trimmed) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/.exec(trimmed);
  if (iso) return ymdIso(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const ymd = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})(?:[ T].*)?$/.exec(trimmed);
  if (ymd) return ymdIso(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));

  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed);
  if (compact) return ymdIso(Number(compact[1]), Number(compact[2]) - 1, Number(compact[3]));

  const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[ T].*)?$/.exec(trimmed);
  if (dmy) return fromParts(Number(dmy[1]), Number(dmy[2]), Number(dmy[3]));

  const named = /^(\d{1,2})[ \-.]([A-Za-z]{3,9})[ \-.,]+(\d{2,4})$/.exec(trimmed);
  if (named) {
    const month = MONTHS[named[2].toLowerCase()];
    if (month != null) return ymdIso(Number(named[3]), month, Number(named[1]));
  }
  const namedUs = /^([A-Za-z]{3,9})[ \-.](\d{1,2}),?[ \-.]+(\d{2,4})$/.exec(trimmed);
  if (namedUs) {
    const month = MONTHS[namedUs[1].toLowerCase()];
    if (month != null) return ymdIso(Number(namedUs[3]), month, Number(namedUs[2]));
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (n > 20000 && n < 120000) return excelSerialToIso(n);
  }
  return null;
}

function dateObjectToIso(d: Date): string | null {
  if (Number.isNaN(d.getTime())) return null;
  const localMidnight = d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() < 2;
  const utcMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() < 2;
  if (localMidnight && !utcMidnight) {
    return ymdIso(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return ymdIso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function toIso(value: unknown, date1904 = false): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return dateObjectToIso(value);
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 20000 && value < 120000) return excelSerialToIso(value, date1904);
    return null;
  }
  if (typeof value === "string") return parseDateString(value);
  return null;
}

function toAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
    const n = Number(cleaned);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function rowsFromObjects(records: Record<string, unknown>[], date1904 = false): PurchaseRow[] {
  if (records.length === 0) return [];
  const keys = Object.keys(records[0] ?? {});
  const dateKey = keys.find(headerLooksLikeDate) ?? keys[0];
  const amountKey = keys.find(headerLooksLikeAmount) ?? keys.find((k) => k !== dateKey);
  if (!dateKey || !amountKey) {
    throw new Error("Need a Date column and a dollar-amount column.");
  }
  const out: PurchaseRow[] = [];
  for (const rec of records) {
    const iso = toIso(rec[dateKey], date1904);
    const amount = toAmount(rec[amountKey]);
    if (!iso || amount == null) continue;
    if (tFromIso(iso) == null) continue;
    out.push({ iso, amount });
  }
  return out;
}

function parseCsv(text: string): PurchaseRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const records: Record<string, unknown>[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const rec: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      rec[h] = cells[i] ?? "";
    });
    records.push(rec);
  }
  return rowsFromObjects(records);
}

export async function parsePurchaseSheet(file: File): Promise<PurchaseRow[]> {
  const buf = await file.arrayBuffer();
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const rows = parseCsv(new TextDecoder().decode(buf));
    if (rows.length === 0) throw new Error("No dated purchases found in that file.");
    return rows;
  }
  const XLSX = await import("xlsx");
  const bytes = new Uint8Array(buf);
  const dated = XLSX.read(bytes, { type: "array", cellDates: true });
  const sheetName = dated.SheetNames[0];
  if (!sheetName) throw new Error("That workbook has no sheets.");
  const date1904 = Boolean(dated.Workbook?.WBProps?.date1904);
  let rows = rowsFromObjects(
    XLSX.utils.sheet_to_json<Record<string, unknown>>(dated.Sheets[sheetName], {
      raw: true,
      defval: null,
    }),
    date1904,
  );
  if (rows.length === 0) {
    const raw = XLSX.read(bytes, { type: "array", cellDates: false });
    rows = rowsFromObjects(
      XLSX.utils.sheet_to_json<Record<string, unknown>>(raw.Sheets[raw.SheetNames[0]], {
        raw: true,
        defval: null,
      }),
      Boolean(raw.Workbook?.WBProps?.date1904),
    );
  }
  if (rows.length === 0) {
    throw new Error("No dated purchases found in the first sheet.");
  }
  return rows;
}

export function plotPurchases(
  purchases: PurchaseRow[],
  history: HistoryRow[],
  sheetCurrency: FiatCurrency,
  displayCurrency: Currency,
  liveXau = 1800,
  liveFx = 0,
): PlotBuy[] {
  const byT = new Map<number, PlotBuy>();
  for (const row of purchases) {
    const t = tFromIso(row.iso);
    if (t == null) continue;
    const hist = rowAtT(history, t);
    if (!hist) continue;
    const payPx = sheetCurrency === "CAD" ? hist.cad : hist.usd;
    if (payPx <= 0) continue;
    const btc = row.amount / payPx;
    const spot = priceOf(hist, displayCurrency, liveXau, liveFx);
    const existing = byT.get(t);
    if (existing) {
      existing.amount += row.amount;
      existing.btc += btc;
    } else {
      byT.set(t, { t, iso: row.iso, amount: row.amount, btc, r: R_MIN, spot });
    }
  }
  const list = [...byT.values()];
  if (list.length === 0) return list;
  let minAmt = Infinity;
  let maxAmt = 0;
  for (const item of list) {
    minAmt = Math.min(minAmt, item.amount);
    maxAmt = Math.max(maxAmt, item.amount);
  }
  const sMin = Math.sqrt(minAmt);
  const sMax = Math.sqrt(maxAmt);
  for (const item of list) {
    const u = sMax === sMin ? 0.55 : (Math.sqrt(item.amount) - sMin) / (sMax - sMin);
    item.r = R_MIN + u * (R_MAX - R_MIN);
  }
  return list.sort((a, b) => b.r - a.r);
}

export function buyPopDelayMs(buys: Array<{ t: number }>, t: number): number {
  if (buys.length === 0) return 0;
  const times = [...new Set(buys.map((b) => b.t))].sort((a, b) => a - b);
  const i = Math.max(0, times.indexOf(t));
  const n = Math.max(1, times.length - 1);
  const total = Math.min(2400, 80 + n * 42);
  return (i / n) * total;
}

export function purchaseTotals(
  purchases: PurchaseRow[],
  history: HistoryRow[],
  currency: FiatCurrency,
  spot: number,
) {
  let amount = 0;
  let btc = 0;
  for (const row of purchases) {
    amount += row.amount;
    const t = tFromIso(row.iso);
    if (t == null) continue;
    const hist = rowAtT(history, t);
    if (!hist) continue;
    const px = currency === "CAD" ? hist.cad : hist.usd;
    if (px > 0) btc += row.amount / px;
  }
  const avg = btc > 0 ? amount / btc : 0;
  const valueNow = btc * Math.max(spot, 0);
  const total = amount > 0 ? valueNow / amount - 1 : 0;
  return { count: purchases.length, amount, btc, avg, valueNow, total, spot };
}
