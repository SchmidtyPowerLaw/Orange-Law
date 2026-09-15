import { fairPriceUsd, quantilePriceUsd, residualZ } from "@/lib/powerlaw";
import { currencyMark, currencyName, formatPct, formatPrice, type Currency } from "@/lib/format";
import { SigmaMeter } from "@/components/sigma-meter";
import { colorAtZ } from "@/lib/band-color";
import { cn } from "@/lib/utils";

type Props = {
  price: number;
  priceUsd: number;
  currency: Currency;
  t: number;
  dayChange?: number | null;
};

export function PriceHero({ price, priceUsd, currency, t, dayChange = null }: Props) {
  const fair = fairPriceUsd(t) * (price / priceUsd);
  const floor = quantilePriceUsd(t, -2) * (price / priceUsd);
  const top = quantilePriceUsd(t, 2) * (price / priceUsd);
  const vsFair = price / fair - 1;
  const z = residualZ(priceUsd, t);
  const priceColor = colorAtZ(z);
  const changeTone =
    dayChange == null
      ? null
      : dayChange > 0.0005
        ? "text-up"
        : dayChange < -0.0005
          ? "text-down"
          : "text-muted-foreground";

  const mark = currencyMark(currency);

  return (
    <section className="stagger-in mt-24 space-y-8 sm:space-y-12">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <span>Bitcoin</span>
          <span aria-hidden="true">·</span>
          {mark ? (
            <img
              src={mark.src}
              alt=""
              width={mark.wide ? 56 : 28}
              height={28}
              draggable={false}
              className={cn(
                "pointer-events-none shrink-0 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]",
                mark.wide ? "h-6 w-12 sm:h-7 sm:w-14" : "h-6 w-6 sm:h-7 sm:w-7",
              )}
            />
          ) : null}
          <span className="font-semibold tracking-[0.18em] text-sand">{currencyName(currency)}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-x-2.5 gap-y-1">
          <span
            className="tabular font-sans text-4xl font-medium leading-none tracking-tight md:text-5xl"
            style={{ color: priceColor }}
          >
            {formatPrice(price, currency)}
          </span>
          <span className="mb-0.5 inline-flex flex-col items-start font-mono text-xl font-semibold leading-none tabular-nums md:text-2xl">
            {dayChange != null && changeTone ? (
              <span
                className={cn(
                  "whitespace-nowrap rounded-md px-2 py-1",
                  changeTone,
                  dayChange > 0.0005
                    ? "bg-up/15"
                    : dayChange < -0.0005
                      ? "bg-down/15"
                      : "bg-muted",
                )}
                aria-label={`Today's change ${formatPct(dayChange, 2)}`}
              >
                {formatPct(dayChange, 2)}
              </span>
            ) : null}
            <span
              className={cn(
                "mt-1 px-2 text-[0.5em] font-medium leading-none",
                dayChange == null && "px-0",
              )}
              style={{ color: priceColor }}
              aria-label={`Versus fair value ${formatPct(vsFair)}`}
            >
              {formatPct(vsFair)} vs fair
            </span>
          </span>
        </div>
      </div>
      <SigmaMeter priceUsd={priceUsd} t={t} />
      <div className="grid grid-cols-3 gap-x-2">
        <BandPrice label="Floor" value={formatPrice(floor, currency)} tone="floor" />
        <BandPrice label="Fair" value={formatPrice(fair, currency)} tone="fair" />
        <BandPrice label="Top" value={formatPrice(top, currency)} tone="top" />
      </div>
    </section>
  );
}

function BandPrice({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "floor" | "fair" | "top";
}) {
  const color =
    tone === "floor" ? "text-floor" : tone === "fair" ? "text-primary" : "text-chart-top";
  return (
    <div className={cn("min-w-0 text-center", color)}>
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] opacity-80 sm:text-xs">
        {label}
      </p>
      <p className="mt-0.5 truncate font-mono text-xs tabular-nums leading-tight sm:text-sm">
        {value}
      </p>
    </div>
  );
}