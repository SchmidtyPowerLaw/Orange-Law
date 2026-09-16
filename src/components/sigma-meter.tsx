import { residualZ, SIGMA } from "@/lib/powerlaw";
import { formatMultiple, formatSigma } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  priceUsd?: number;
  t?: number;
  z?: number;
  sigma?: number;
};

export function SigmaMeter({ priceUsd = 0, t = 0, z, sigma = SIGMA }: Props) {
  const signed = z ?? residualZ(priceUsd, t);
  const clamped = Math.min(2.15, Math.max(-2.15, signed));
  const pct = ((clamped + 2) / 4) * 100;
  const belowFair = signed < 0;
  const vsFloor = 10 ** ((signed + 2) * sigma);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="font-mono text-sm tabular-nums text-floor">
          {formatSigma(signed)}
          <span className="ml-2 font-sans text-muted-foreground">
            {belowFair ? "below" : "above"} fair value
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground">{formatMultiple(vsFloor)}</span>
          {" "}the floor
        </p>
      </div>
      <div className="relative h-3 rounded-full sigma-fill shadow-[var(--shadow-border)]">
        <span
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-[0_0_0_3px_var(--color-card)]"
          style={{ left: `${pct}%` }}
          aria-hidden
        />
      </div>
      <div className="flex justify-between font-mono text-xs uppercase tracking-wider text-muted-foreground">
        <span className="text-floor">−2σ</span>
        <span>−1σ</span>
        <span className="text-primary">Fair</span>
        <span>+1σ</span>
        <span className="text-destructive">+2σ</span>
      </div>
    </div>
  );
}

export function SigmaCaption({ className, gold = false }: { className?: string; gold?: boolean }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {gold
        ? "GOLD bands follow Giovanni’s Gold/BTC power law (β = 5.41, σ = 0.330 dex) using each day’s gold print — not a constant conversion of the dollar law."
        : "Bands are log-normal quantiles around the fitted law (σ = 0.302 dex). Cycle swings of about ±1σ are typical; a print more than 3σ below the fit would falsify the floor."}
    </p>
  );
}
