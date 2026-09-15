import { useState } from "react";
import { HORIZONS_YEARS, forwardProjections, type ForwardCell, type HorizonYear } from "@/lib/powerlaw";
import { formatDay, formatPct, formatPrice, type Currency } from "@/lib/format";
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

export function ForwardReturns({ tNow, priceNow, fx, currency }: Props) {
  const rows = forwardProjections(tNow, priceNow, fx);
  const [years, setYears] = useState<HorizonYear>(5);
  const selected = rows.find((row) => row.years === years) ?? rows[0];

  return (
    <section className="min-w-0 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Model forwards
      </p>

      <div className="mt-2 flex items-end justify-between gap-3 md:hidden">
        <div className="min-w-0">
          <h2 className="font-display text-2xl text-foreground">
            {selected ? `${selected.years}-year path` : "Forward path"}
          </h2>
          {selected ? (
            <p className="mt-1 text-xs text-muted-foreground">{formatDay(selected.t)}</p>
          ) : null}
        </div>
        <label className="shrink-0">
          <span className="sr-only">Time horizon</span>
          <select
            aria-label="Time horizon"
            value={years}
            onChange={(ev) => setYears(Number(ev.target.value) as HorizonYear)}
            className="h-11 min-w-[7.5rem] rounded-md bg-muted px-3 text-sm font-medium text-foreground shadow-[var(--shadow-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            {HORIZONS_YEARS.map((n) => (
              <option key={n} value={n}>
                {n} year
              </option>
            ))}
          </select>
        </label>
      </div>
      <h2 className="mt-2 hidden font-display text-2xl text-foreground md:block">
        1 · 3 · 5 · 10 year paths
      </h2>

      <p className="mt-2 hidden max-w-prose text-sm leading-relaxed text-muted-foreground md:block">
        From the live price, each band is the model price at that horizon. Returns
        are versus today, not versus the quantile you sit on now.
      </p>

      {selected ? (
        <div className="mt-5 md:hidden">
          <article className="rounded-lg bg-raised p-4">
            <ul className="space-y-1">
              {selected.cells.map((cell) => (
                <ForwardLine key={cell.id} cell={cell} currency={currency} />
              ))}
            </ul>
          </article>
        </div>
      ) : null}

      <div className="mt-5 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="sticky left-0 bg-card pb-3 pr-4 font-medium">Horizon</th>
              {rows[0]?.cells.map((c) => (
                <th key={c.id} className={cn("pb-3 pr-4 font-medium", TONE[c.id])}>
                  {c.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.years} className="align-top">
                <th className="sticky left-0 bg-card py-3 pr-4 text-left font-display text-base font-medium">
                  {row.years}y
                  <div className="font-sans text-xs font-normal text-muted-foreground">
                    {formatDay(row.t)}
                  </div>
                </th>
                {row.cells.map((cell) => (
                  <td key={cell.id} className="py-3 pr-4">
                    <p className={cn("font-mono tabular-nums", TONE[cell.id])}>
                      {formatPrice(cell.price, currency)}
                    </p>
                    <p
                      className={`font-mono text-xs tabular-nums ${cell.total >= 0 ? "text-up" : "text-down"}`}
                    >
                      {formatPct(cell.total, cell.total > 9 ? 0 : 1)} tot
                    </p>
                    <p className="font-mono text-xs tabular-nums text-muted-foreground">
                      {formatPct(cell.cagr, 1)} / yr
                    </p>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ForwardLine({ cell, currency }: { cell: ForwardCell; currency: Currency }) {
  return (
    <li className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-baseline gap-x-2 border-b border-border/70 py-1.5 last:border-0">
      <span className={cn("text-xs font-medium", TONE[cell.id])}>{cell.short}</span>
      <span className="truncate text-right font-mono text-sm tabular-nums">
        {formatPrice(cell.price, currency)}
      </span>
      <span className="text-right">
        <span
          className={`block font-mono text-sm tabular-nums ${cell.total >= 0 ? "text-up" : "text-down"}`}
        >
          {formatPct(cell.total, cell.total > 9 ? 0 : 1)}
        </span>
        <span className="block font-mono text-xs tabular-nums text-muted-foreground">
          {formatPct(cell.cagr, 1)} /yr
        </span>
      </span>
    </li>
  );
}
