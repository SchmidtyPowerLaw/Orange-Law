import { useMemo, useState } from "react";
import {
  HORIZONS_YEARS,
  MAX_TARGET_ISO,
  calendarIso,
  shiftIsoYears,
  stackProjection,
  tFromIso,
  tomorrowIso,
  type StackBand,
} from "@/lib/powerlaw";
import {
  formatBtc,
  formatDay,
  formatPct,
  formatPercentile,
  formatPrice,
  holdingsToDraft,
  type Currency,
} from "@/lib/format";
import { useSettings } from "@/lib/settings";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  tNow: number;
  priceNow: number;
  fx: number;
  currency: Currency;
};

const TONE: Record<string, string> = {
  floor: "text-floor",
  low: "text-chart-low",
  fair: "text-primary",
  high: "text-chart-high",
  top: "text-destructive",
};

const HOLDINGS_PATTERN = /^\d*\.?\d{0,8}$/;

function parseHoldings(raw: string): number | null {
  if (raw.trim() === "" || raw === ".") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(n, 21_000_000);
}

function matchingPreset(iso: string): number | null {
  const today = calendarIso();
  for (const years of HORIZONS_YEARS) {
    if (shiftIsoYears(today, years) === iso) return years;
  }
  return null;
}

export function StackProjection({ tNow, priceNow, fx, currency }: Props) {
  const holdings = useSettings((s) => s.holdings);
  const targetDate = useSettings((s) => s.targetDate);
  const setHoldings = useSettings((s) => s.setHoldings);
  const setTargetDate = useSettings((s) => s.setTargetDate);

  const [draft, setDraft] = useState<string | null>(null);
  const holdingsText = draft ?? holdingsToDraft(holdings);
  const parsedHoldings = parseHoldings(holdingsText);
  const amount = parsedHoldings != null && parsedHoldings > 0 ? parsedHoldings : 0;

  const minDate = tomorrowIso();
  const tTarget = tFromIso(targetDate);
  const dateInRange = Boolean(tTarget && tTarget > tNow && targetDate <= MAX_TARGET_ISO);
  const preset = matchingPreset(targetDate);

  const projection = useMemo(() => {
    if (!tTarget || !dateInRange || amount <= 0) return null;
    return stackProjection(tNow, priceNow, fx, tTarget, amount);
  }, [tTarget, dateInRange, amount, tNow, priceNow, fx]);

  const fair = projection?.bands.find((b) => b.id === "fair") ?? null;

  const onHoldingsChange = (raw: string) => {
    if (raw !== "" && !HOLDINGS_PATTERN.test(raw)) return;
    setDraft(raw);
    const n = parseHoldings(raw);
    setHoldings(n ?? 0);
  };

  return (
    <section className="min-w-0 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] md:p-6">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Your stack
      </p>
      <h2 className="mt-2 font-display text-2xl text-foreground">
        What is it worth later?
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
        Enter how many bitcoin you own and a date. Each quantile is the model
        price that day, the matching stack value, and the annualized return
        versus today.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4">
          <div>
            <label htmlFor="stack-btc" className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Bitcoin you own
            </label>
            <div className="relative mt-2">
              <Input
                id="stack-btc"
                inputMode="decimal"
                autoComplete="off"
                placeholder="2"
                value={holdingsText}
                onChange={(e) => onHoldingsChange(e.target.value)}
                onBlur={() => setDraft(null)}
                aria-label="Bitcoin holdings"
                className="pr-14 font-mono tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                BTC
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="stack-date" className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Target date
            </label>
            <Input
              id="stack-date"
              type="date"
              value={targetDate}
              min={minDate}
              max={MAX_TARGET_ISO}
              onChange={(e) => {
                const next = e.target.value;
                if (next) setTargetDate(next);
              }}
              aria-label="Projection date"
              className="mt-2 font-mono tabular-nums"
            />
          </div>

          <div
            role="radiogroup"
            aria-label="Horizon presets"
            className="flex flex-wrap gap-2"
          >
            {HORIZONS_YEARS.map((years) => {
              const active = preset === years;
              return (
                <button
                  key={years}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTargetDate(shiftIsoYears(calendarIso(), years))}
                  className={cn(
                    "h-11 min-w-11 rounded-md px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 ease-out",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground shadow-[var(--shadow-border)] hover:text-foreground",
                  )}
                >
                  {years}Y
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 lg:col-span-2">
          {projection && fair ? (
            <FairHero
              projectionDate={formatDay(projection.t)}
              years={projection.years}
              days={projection.days}
              holdings={projection.holdings}
              stackNow={projection.stackNow}
              fair={fair}
              currency={currency}
            />
          ) : (
            <EmptyHint amount={amount} dateInRange={dateInRange} />
          )}
        </div>
      </div>

      {projection ? (
        <>
          <div className="mt-6 space-y-1 md:hidden">
            {projection.bands.map((band) => (
              <BandLine key={band.id} band={band} currency={currency} />
            ))}
          </div>

          <div className="mt-6 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Band</th>
                  <th className="pb-3 pr-4 text-right font-medium">BTC price</th>
                  <th className="pb-3 pr-4 text-right font-medium">Stack</th>
                  <th className="pb-3 pr-4 text-right font-medium">Total</th>
                  <th className="pb-3 text-right font-medium">Annualized</th>
                </tr>
              </thead>
              <tbody>
                {projection.bands.map((band) => {
                  const isFair = band.id === "fair";
                  return (
                    <tr
                      key={band.id}
                      className={cn(isFair && "bg-raised")}
                    >
                      <th className="rounded-l-md py-3 pr-4 pl-3 text-left font-medium">
                        <span className={cn("block", TONE[band.id])}>{band.label}</span>
                        <span className="block font-sans text-xs font-normal text-muted-foreground">
                          {formatPercentile(band.p)} percentile
                        </span>
                      </th>
                      <td className={cn("py-3 pr-4 text-right font-mono tabular-nums", TONE[band.id])}>
                        {formatPrice(band.price, currency)}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums text-foreground">
                        {formatPrice(band.stack, currency)}
                      </td>
                      <td
                        className={`py-3 pr-4 text-right font-mono tabular-nums ${band.total >= 0 ? "text-up" : "text-down"}`}
                      >
                        {formatPct(band.total, band.total > 9 ? 0 : 1)}
                      </td>
                      <td
                        className={`rounded-r-md py-3 pr-3 text-right font-mono tabular-nums ${band.cagr >= 0 ? "text-up" : "text-down"}`}
                      >
                        {formatPct(band.cagr, 1)}
                        <span className="ml-1 text-muted-foreground">/ yr</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

function FairHero({
  projectionDate,
  years,
  days,
  holdings,
  stackNow,
  fair,
  currency,
}: {
  projectionDate: string;
  years: number;
  days: number;
  holdings: number;
  stackNow: number;
  fair: StackBand;
  currency: Currency;
}) {
  return (
    <div className="rounded-lg bg-raised px-4 py-4 shadow-[var(--shadow-border)] md:px-5">
      <p className="text-xs text-muted-foreground">
        {formatBtc(holdings)} on {projectionDate}
        <span className="mx-2 text-border">·</span>
        {days.toLocaleString("en-CA")} days · {years.toFixed(2)} years
      </p>
      <p className="mt-3 font-display text-3xl leading-none tracking-tight text-foreground md:text-4xl">
        <span className="font-sans font-medium tabular-nums">
          {formatPrice(fair.stack, currency)}
        </span>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Fair-value stack
        <span className="mx-1.5 text-border">·</span>
        {formatBtc(holdings)} × {formatPrice(fair.price, currency)}
      </p>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-sm tabular-nums">
        <p className={fair.total >= 0 ? "text-up" : "text-down"}>
          {formatPct(fair.total, fair.total > 9 ? 0 : 1)}{" "}
          <span className="text-muted-foreground">total</span>
        </p>
        <p className={fair.cagr >= 0 ? "text-up" : "text-down"}>
          {formatPct(fair.cagr, 1)}{" "}
          <span className="text-muted-foreground">/ yr</span>
        </p>
        <p className="text-muted-foreground">
          Today{" "}
          <span className="text-foreground">{formatPrice(stackNow, currency)}</span>
        </p>
      </div>
    </div>
  );
}

function EmptyHint({ amount, dateInRange }: { amount: number; dateInRange: boolean }) {
  let message = "Enter your holdings and a future date to project the stack.";
  if (amount <= 0 && dateInRange) {
    message = "Enter how many bitcoin you own to size the stack.";
  } else if (amount > 0 && !dateInRange) {
    message = "Pick a date after today, out to 2060.";
  }
  return (
    <div className="rounded-lg bg-raised px-4 py-4 text-sm leading-relaxed text-muted-foreground shadow-[var(--shadow-border)] md:px-5 md:py-6">
      {message}
    </div>
  );
}

function BandLine({ band, currency }: { band: StackBand; currency: Currency }) {
  return (
    <article
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-border/70 py-3 last:border-0",
        band.id === "fair" && "rounded-md bg-raised px-3",
      )}
    >
      <div className="min-w-0">
        <p className={cn("text-sm font-medium", TONE[band.id])}>{band.short}</p>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatPrice(band.price, currency)} / BTC
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-base tabular-nums">{formatPrice(band.stack, currency)}</p>
        <p className={`font-mono text-xs tabular-nums ${band.cagr >= 0 ? "text-up" : "text-down"}`}>
          {formatPct(band.total, band.total > 9 ? 0 : 1)} tot
          <span className="mx-1 text-muted-foreground">·</span>
          {formatPct(band.cagr, 1)} / yr
        </p>
      </div>
    </article>
  );
}
