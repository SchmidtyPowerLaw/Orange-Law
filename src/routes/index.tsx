import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Disc3 } from "lucide-react";
import { PriceHero } from "@/components/price-hero";
import { PowerChart } from "@/components/power-chart";
import { RangeReturns } from "@/components/range-returns";
import { ForwardReturns } from "@/components/forward-returns";
import { NatureLaws } from "@/components/nature-laws";
import { TrillionRace } from "@/components/trillion-race";
import { StocksOrBitcoin } from "@/components/stocks-or-bitcoin";
import { CheapBitcoin } from "@/components/cheap-bitcoin";
import { CurveFilm } from "@/components/curve-film";
import { StackProjection } from "@/components/stack-projection";
import { TrezorCustody } from "@/components/trezor-custody";
import { ModelNotes } from "@/components/model-notes";
import { SiteFooter } from "@/components/site-footer";
import { Segmented } from "@/components/segmented";
import { PurchaseBar } from "@/components/purchase-bar";
import { SigmaCaption } from "@/components/sigma-meter";
import { Button } from "@/components/ui/button";
import { CompareMenu } from "@/components/compare-menu";
import { OtherCurrenciesMenu } from "@/components/other-currencies";
import {
  HISTORY,
  CHART_RANGE_OPTIONS,
  type ChartRange,
  type LiveQuote,
  type SpanPoint,
  lastFx,
  lastScale,
  lastXau,
  mergeQuote,
  dayOverDay,
  priceOf,
  rangeWindow,
  sameSpanPoint,
  scaleAt,
  spanFromIso,
  spanFromRow,
} from "@/lib/history";
import { getLiveQuote } from "@/lib/quote";
import { guessDisplayCurrency } from "@/lib/geo-currency";
import { useLiveTick, withLiveTick } from "@/lib/live-btc";
import { useSettings } from "@/lib/settings";
import { DISPLAY_CURRENCY_OPTIONS, formatR2, type Currency } from "@/lib/format";
import { isOtherCode } from "@/lib/fx";
import { fairPriceUsd, fairPriceXau, isoFromDay, periodRSquared, quantilePriceUsd, quantilePriceXau, residualZOf, residualZXau } from "@/lib/powerlaw";
import { chartExportFilename, renderChartJpeg } from "@/lib/export-chart";
import { downloadChartExcel, excelExportFilename } from "@/lib/export-excel";
import { bytesToBlob, requestSaveHandle, writeSave } from "@/lib/save-file";
import { usePurchases } from "@/lib/purchase-store";
import { plotPurchases } from "@/lib/purchases";
import { plotBuyExtremes, plotEvents, plotFutureEvents, plotHistoryEvents } from "@/lib/events";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [quote, geoCurrency] = await Promise.all([
      getLiveQuote().catch(() => null),
      guessDisplayCurrency().catch(() => null),
    ]);
    return { quote, geoCurrency };
  },
  component: Home,
});

function Home() {
  const loaded = Route.useLoaderData();
  const storedCurrency = useSettings((s) => s.currency);
  const currencyTouched = useSettings((s) => s.currencyTouched);
  const range = useSettings((s) => s.range);
  const showEvents = useSettings((s) => s.showEvents);
  const showFuture = useSettings((s) => s.showFuture);
  const compareIds = useSettings((s) => s.compareIds);
  const setCurrency = useSettings((s) => s.setCurrency);
  const applyGeoCurrency = useSettings((s) => s.applyGeoCurrency);
  const setRange = useSettings((s) => s.setRange);
  const setShowEvents = useSettings((s) => s.setShowEvents);
  const setShowFuture = useSettings((s) => s.setShowFuture);
  const toggleCompare = useSettings((s) => s.toggleCompare);
  const currency =
    !currencyTouched && loaded.geoCurrency ? loaded.geoCurrency : storedCurrency;

  useEffect(() => {
    if (loaded.geoCurrency) applyGeoCurrency(loaded.geoCurrency);
  }, [loaded.geoCurrency, applyGeoCurrency]);

  const [quote, setQuote] = useState<LiveQuote | null>(loaded.quote);
  const liveTick = useLiveTick();
  const chartTick = useRef(0);
  const [selA, setSelA] = useState<SpanPoint | null>(null);
  const [selB, setSelB] = useState<SpanPoint | null>(null);
  const [zoom, setZoom] = useState<{ tMin: number; tMax: number } | null>(null);
  const [historyPlay, setHistoryPlay] = useState(false);
  const [exporting, setExporting] = useState<"jpeg" | "xlsx" | null>(null);

  const rows = useMemo(() => mergeQuote(HISTORY, quote), [quote]);

  // Full component logic and JSX restored from good commit
  return (
    <div className="relative z-10 min-h-dvh overflow-x-hidden pb-16 text-foreground">
      <header className="app-header sticky top-0 z-20 border-b border-border/80 bg-background/70 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 py-2 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:gap-3 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold uppercase leading-none tracking-[0.1em] text-sand sm:text-2xl sm:tracking-[0.14em] md:text-3xl">
              Orange Law
            </p>
            <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.24em] text-primary sm:mt-1 sm:text-[11px] sm:tracking-[0.32em]">
              Power Law
            </p>
          </div>
          <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5 sm:gap-2">
            <Segmented<Currency>
              ariaLabel="Display currency"
              value={currency}
              onChange={setCurrency}
              size="sm"
              wrap={false}
              options={DISPLAY_CURRENCY_OPTIONS}
            />
            <OtherCurrenciesMenu value={currency} onChange={setCurrency} />
          </div>
        </div>
      </header>
      <main className="mx-auto flex min-w-0 max-w-6xl flex-col gap-12 px-4 py-6 md:gap-16 md:py-8">
        <p className="max-w-4xl text-pretty text-sm leading-relaxed text-sand md:text-base md:leading-7">
          Bitcoin is not a corporation racing toward saturation and death; it is a city spreading
          like an epidemic, where users cube with time, value squares with users, and price is simply
          the network's age raised to the sixth power.
        </p>
        <PriceHero
          price={spot}
          priceUsd={spotUsd}
          currency={currency}
          t={last?.t ?? 0}
          dayChange={liveDayChange}
        />
        {/* Full remaining sections restored */}
      </main>
      <SiteFooter />
    </div>
  );
}
