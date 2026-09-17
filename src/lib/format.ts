import { dateFromDay } from "@/lib/powerlaw";
import { isOtherCode, type OtherCode } from "@/lib/fx";

export type FiatCurrency = "USD" | "CAD";
export type Currency = FiatCurrency | "XAU" | OtherCode;

export const DISPLAY_CURRENCY_OPTIONS: {
  value: Currency;
  label: string;
  icon?: string;
  iconWide?: boolean;
}[] = [
  { value: "USD", label: "USD", icon: "/usd-bill.png", iconWide: true },
  { value: "CAD", label: "CAD", icon: "/cad-bill.png", iconWide: true },
  { value: "XAU", label: "GOLD", icon: "/gold-bar.png" },
];

export const FIAT_CURRENCY_OPTIONS: {
  value: FiatCurrency;
  label: string;
  icon?: string;
  iconWide?: boolean;
}[] = [
  { value: "CAD", label: "CAD", icon: "/cad-bill.png", iconWide: true },
  { value: "USD", label: "USD", icon: "/usd-bill.png", iconWide: true },
];

export function isCurrency(value: unknown): value is Currency {
  return value === "USD" || value === "CAD" || value === "XAU" || isOtherCode(value);
}

export function currencyName(currency: Currency): string {
  return currency === "XAU" ? "GOLD" : currency;
}

export function currencyMark(currency: Currency): { src: string; wide: boolean } | null {
  const opt = DISPLAY_CURRENCY_OPTIONS.find((item) => item.value === currency);
  if (!opt?.icon) return null;
  return { src: opt.icon, wide: Boolean(opt.iconWide) };
}

function symbol(currency: Currency): string {
  if (currency === "CAD") return "C$";
  if (currency === "XAU") return "";
  if (currency === "EUR") return "€";
  if (currency === "TRY") return "₺";
  if (currency === "VND") return "₫";
  if (currency === "BRL") return "R$";
  if (currency === "INR") return "₹";
  if (currency === "UAH") return "₴";
  if (currency === "NGN") return "₦";
  if (currency === "AED") return "AED ";
  if (currency === "IQD") return "IQD ";
  if (currency === "MXN") return "MX$";
  if (currency === "PHP") return "₱";
  if (currency === "THB") return "฿";
  return "$";
}

function formatOz(abs: number, compact: boolean): string {
  if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(compact ? 1 : 2)}M oz`;
  if (abs >= 10_000) return `${Math.round(abs).toLocaleString("en-CA")} oz`;
  if (abs >= 100) {
    return `${abs.toLocaleString("en-CA", { maximumFractionDigits: compact ? 0 : 1 })} oz`;
  }
  if (abs >= 10) {
    return `${abs.toLocaleString("en-CA", { maximumFractionDigits: 1, minimumFractionDigits: compact ? 0 : 1 })} oz`;
  }
  if (abs >= 1) {
    return `${abs.toLocaleString("en-CA", { maximumFractionDigits: 2, minimumFractionDigits: compact ? 1 : 2 })} oz`;
  }
  if (abs >= 0.01) return `${abs.toFixed(compact ? 2 : 3)} oz`;
  if (abs >= 0.001) return `${abs.toFixed(4)} oz`;
  if (abs >= 0.0001) return `${abs.toFixed(4)} oz`;
  if (abs >= 0.00001) return `${abs.toFixed(5)} oz`;
  if (abs > 0) return `${abs.toExponential(0).replace("e+", "e")} oz`;
  return "0 oz";
}

export function formatPrice(value: number, currency: Currency): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (currency === "XAU") return `${sign}${formatOz(abs, false)}`;
  const sym = symbol(currency);
  if (abs >= 1_000_000_000_000) {
    return `${sign}${sym}${(abs / 1_000_000_000_000).toLocaleString("en-CA", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}T`;
  }
  if (abs >= 1_000_000_000) {
    return `${sign}${sym}${(abs / 1_000_000_000).toLocaleString("en-CA", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${sym}${(abs / 1_000_000).toLocaleString("en-CA", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}M`;
  }
  if (abs >= 1000) {
    return `${sign}${sym}${abs.toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;
  }
  if (abs >= 1) {
    return `${sign}${sym}${abs.toLocaleString("en-CA", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  }
  return `${sign}${sym}${abs.toFixed(abs >= 0.01 ? 4 : 5)}`;
}

export function formatPriceCompact(value: number, currency: Currency): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (currency === "XAU") return `${sign}${formatOz(abs, true)}`;
  const sym = symbol(currency);
  if (abs >= 1_000_000_000_000) return `${sign}${sym}${(abs / 1_000_000_000_000).toFixed(1)}T`;
  if (abs >= 1_000_000_000) return `${sign}${sym}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}${sym}${Math.round(abs).toLocaleString("en-CA")}`;
  if (abs >= 1000) return `${sign}${sym}${abs.toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;
  if (abs >= 1) return `${sign}${sym}${abs.toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;
  if (abs >= 0.1) return `${sign}${sym}${abs.toFixed(2)}`;
  return `${sign}${sym}${abs.toFixed(3)}`;
}

export function formatPct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value) * 100;
  const body = abs.toLocaleString("en-CA", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
  if (value > 0.0005) return `+${body}%`;
  if (value < -0.0005) return `−${body}%`;
  return `${(0).toFixed(digits)}%`;
}

export function formatReturn(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const multiple = value + 1;
  if (multiple >= 100) return formatMultiple(multiple);
  if (value <= -0.9) return formatPct(value, 0);
  if (Math.abs(value) >= 10) return formatPct(value, 0);
  return formatPct(value, 1);
}

export function formatSigma(z: number): string {
  const abs = Math.abs(z);
  const body = abs.toLocaleString("en-CA", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  if (z > 0) return `+${body}σ`;
  if (z < 0) return `−${body}σ`;
  return "0.00σ";
}

export function formatDay(t: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateFromDay(t));
}

export function formatYear(t: number): string {
  return String(dateFromDay(t).getUTCFullYear());
}

export function formatMultiple(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("en-CA", { maximumFractionDigits: 2 })}M×`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString("en-CA", { maximumFractionDigits: 1 })}k×`;
  }
  const digits = value >= 10 ? 1 : 2;
  return `${value.toLocaleString("en-CA", { maximumFractionDigits: digits, minimumFractionDigits: digits })}×`;
}

export function formatBtc(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1000) {
    return `${sign}${abs.toLocaleString("en-CA", { maximumFractionDigits: 2 })} BTC`;
  }
  if (abs >= 1) {
    return `${sign}${abs.toLocaleString("en-CA", { maximumFractionDigits: 4, minimumFractionDigits: 0 })} BTC`;
  }
  if (abs >= 0.0001) {
    return `${sign}${abs.toLocaleString("en-CA", { maximumFractionDigits: 6 })} BTC`;
  }
  return `${sign}${abs.toFixed(8)} BTC`;
}

export function formatPercentile(p: number): string {
  if (!Number.isFinite(p)) return "—";
  const pct = p * 100;
  const rounded = Math.round(pct);
  if (Math.abs(pct - rounded) < 0.05) return ordinal(rounded);
  const body = pct.toFixed(1);
  return `${body}th`;
}

function ordinal(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  let suffix = "th";
  if (mod10 === 1 && mod100 !== 11) suffix = "st";
  else if (mod10 === 2 && mod100 !== 12) suffix = "nd";
  else if (mod10 === 3 && mod100 !== 13) suffix = "rd";
  return `${n}${suffix}`;
}

export function holdingsToDraft(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  if (Number.isInteger(n)) return String(n);
  const text = n.toFixed(8).replace(/\.?0+$/, "");
  return text;
}

export function formatR2(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const body = abs.toLocaleString("en-CA", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  return value < 0 ? `−${body}` : body;
}
