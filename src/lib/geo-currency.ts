import { createServerFn } from "@tanstack/react-start";
import type { FiatCurrency } from "@/lib/format";

function countryToCurrency(code: string | null | undefined): FiatCurrency | null {
  const cc = (code ?? "").trim().toUpperCase();
  if (cc === "CA") return "CAD";
  if (cc === "US") return "USD";
  return null;
}

function currencyFromLanguage(header: string | null | undefined): FiatCurrency | null {
  if (!header) return null;
  if (/(^|[,; ])(en|fr|iu)-CA\b/i.test(header)) return "CAD";
  if (/(^|[,; ])en-US\b/i.test(header)) return "USD";
  return null;
}

async function countryFromIp(ip: string): Promise<FiatCurrency | null> {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("127.")) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}?fields=country_code,success`,
      { signal: ctrl.signal, headers: { accept: "application/json" } },
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; country_code?: string };
    if (!json?.success) return null;
    return countryToCurrency(json.country_code);
  } catch {
    return null;
  }
}

export const guessDisplayCurrency = createServerFn({ method: "GET" }).handler(
  async (): Promise<FiatCurrency | null> => {
    const { getRequestHeader, getRequestIP } = await import("@tanstack/react-start/server");
    const fromCountry = countryToCurrency(
      getRequestHeader("cf-ipcountry") ||
        getRequestHeader("x-vercel-ip-country") ||
        getRequestHeader("x-country-code") ||
        getRequestHeader("cloudfront-viewer-country"),
    );
    if (fromCountry) return fromCountry;
    const ip = getRequestIP({ xForwardedFor: true }) ?? "";
    const fromIp = await countryFromIp(ip);
    if (fromIp) return fromIp;
    return currencyFromLanguage(getRequestHeader("accept-language"));
  },
);
