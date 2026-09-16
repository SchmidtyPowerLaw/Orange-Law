import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Disc3 } from "lucide-react";
import { PriceHero } from "@/components/price-hero";
import { PowerChart } from "@/components/power-chart";
import { RangeReturns } from "@/components/range-returns";
import { ForwardReturns } from "@/components/forward-returns";
import { NatureLaws } from "@/components/nature-laws";
import { StackProjection } from "@/components/stack-projection";
import { ModelNotes } from "@/components/model-notes";
import { SiteFooter } from "@/components/site-footer";
import { Segmented } from "@/components/segmented";
import { PurchaseBar } from "@/components/purchase-bar";
import { SigmaCaption } from "@/components/sigma-meter";
import { Button } from "@/components/ui/button";
import { CompareMenu } from "@/components/compare-menu";
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
  spanFromIso,
  spanFromRow,
} from "@/lib/history";
import { getLiveQuote } from "@/lib/quote";
import { guessDisplayCurrency } from "@/lib/geo-currency";
import { useLiveTick, withLiveTick } from "@/lib/live-btc";
import { useSettings } from "@/lib/settings";
import { DISPLAY_CURRENCY_OPTIONS, formatR2, type Currency } from "@/lib/format";
import { fairPriceUsd, fairPriceXau, isoFromDay, periodRSquared, quantilePriceUsd, quantilePriceXau, residualZOf, residualZXau } from "@/lib/powerlaw";
import { chartExportFilename, downloadChartJpeg, renderChartJpeg } from "@/lib/export-chart";
import { downloadChartExcel, excelExportFilename } from "@/lib/export-excel";
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

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const next = await getLiveQuote();
        if (alive) setQuote(next);
      } catch {
        /* keep historical last print */
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!liveTick || !(liveTick.usd > 0)) return;
    const now = Date.now();
    if (chartTick.current !== 0 && now - chartTick.current < 12_000) return;
    chartTick.current = now;
    setQuote((q) => {
      if (!q) return q;
      const next = withLiveTick(q, liveTick);
      if (
        Math.abs(next.usd - q.usd) / Math.max(q.usd, 1) < 0.00015 &&
        Math.abs(next.cad - q.cad) / Math.max(q.cad, 1) < 0.00015 &&
        Math.abs(next.xau - q.xau) < 0.15
      ) {
        return q;
      }
      return next;
    });
  }, [liveTick]);

  const selRef = useRef({
    a: null as SpanPoint | null,
    b: null as SpanPoint | null,
  });
  selRef.current = { a: selA, b: selB };

  const onSelectPoint = useCallback((point: SpanPoint) => {
    const { a, b } = selRef.current;
    if (a == null || b != null) {
      setSelA(point);
      setSelB(null);
      return;
    }
    if (sameSpanPoint(a, point)) return;
    setSelB(point);
  }, []);

  const onClearPoints = useCallback(() => {
    setSelA(null);
    setSelB(null);
  }, []);
  const onClear = () => {
    if (rows.length === 0) return;
    setSelA(spanFromRow(rows[0]));
    setSelB(spanFromRow(rows[rows.length - 1]));
  };

  const onSpanDate = (edge: "start" | "end", iso: string) => {
    const point = spanFromIso(iso, rows, lastFx(rows, quote), lastXau(rows, quote));
    if (!point) return;
    const a = selRef.current.a;
    const b = selRef.current.b;
    const earlier = a && b ? (a.t <= b.t ? a : b) : a;
    const later = a && b ? (a.t <= b.t ? b : a) : b;
    if (edge === "start") {
      setSelA(point);
      setSelB(later && later.t !== point.t ? later : b);
      return;
    }
    if (!a && !b) {
      setSelA(point);
      return;
    }
    setSelA(earlier ?? a);
    setSelB(point);
  };

  const onRange = (next: ChartRange) => {
    setZoom(null);
    setRange(next);
  };

  const last = rows[rows.length - 1];
  const fxCad = lastFx(rows, quote);
  const xau = lastXau(rows, quote);
  const spotUsd = (liveTick && liveTick.usd > 0 ? liveTick.usd : null) ?? quote?.usd ?? last?.usd ?? 0;
  const spotCad =
    (liveTick && liveTick.cad > 0 ? liveTick.cad : null) ?? quote?.cad ?? (fxCad > 0 ? spotUsd * fxCad : 0);
  const liveGold =
    (liveTick && liveTick.xau > 0 ? liveTick.xau : null) ?? (xau > 0 ? xau : 0);
  const spot =
    currency === "CAD" ? spotCad : currency === "XAU" ? (liveGold > 0 ? spotUsd / liveGold : 0) : spotUsd;
  const fx = lastScale(rows, quote, currency);
  const liveDayChange = dayOverDay(spot, currency, quote, rows);
  const r2 = useMemo(() => {
    if (!last || rows.length === 0) return null;
    const preset = rangeWindow(range, last.t, rows[0].t);
    const tMin = zoom?.tMin ?? preset.tMin;
    const tMax = Math.min(last.t, zoom?.tMax ?? last.t);
    const series =
      currency === "XAU"
        ? rows.map((r) => ({ t: r.t, usd: r.xau > 0 ? r.usd / r.xau : 0 }))
        : rows;
    return periodRSquared(series, tMin, tMax);
  }, [rows, range, last, zoom, currency]);

  const purchaseRows = usePurchases((s) => s.rows);
  const buyCurrency = usePurchases((s) => s.currency);
  const showBuys = usePurchases((s) => s.show);
  const buys = useMemo(
    () => plotPurchases(purchaseRows, rows, buyCurrency, currency, xau, lastFx(rows, quote)),
    [purchaseRows, rows, buyCurrency, currency, xau, quote],
  );
  const events = useMemo(
    () => plotEvents(rows, currency, xau, lastFx(rows, quote)),
    [rows, currency, xau, quote],
  );
  const futureEvents = useMemo(() => {
    if (!showFuture || !last) return [];
    const zNow =
      currency === "XAU" ? residualZXau(spot, last.t) : residualZOf(last.usd, last.t, 1);
    return plotFutureEvents(last.t, zNow, lastScale(rows, quote, currency), currency);
  }, [showFuture, last, rows, quote, currency, spot]);
  const chartEvents = showFuture ? [...events, ...futureEvents] : events;
  const buyEvents = useMemo(
    () => (showBuys ? plotBuyExtremes(purchaseRows, rows, currency, xau, lastFx(rows, quote)) : []),
    [showBuys, purchaseRows, rows, currency, xau, quote],
  );
  const historyEvents = useMemo(
    () => plotHistoryEvents(rows, currency, xau, lastFx(rows, quote)),
    [rows, currency, xau, quote],
  );

  const toggleHistory = () => {
    if (historyPlay) {
      setHistoryPlay(false);
      return;
    }
    setRange("all");
    setZoom(null);
    setShowEvents(false);
    setShowFuture(false);
    setHistoryPlay(true);
  };

  const exportGraph = async () => {
    if (exporting) return;
    const node = document.getElementById("orange-law-chart");
    if (!(node instanceof HTMLElement)) return;
    setExporting("jpeg");
    try {
      await downloadChartJpeg(node, chartExportFilename(currency, range));
    } catch {
      /* keep the live chart; retry from the button */
    } finally {
      setExporting(null);
    }
  };

  const exportExcel = async () => {
    if (exporting || !last || rows.length === 0) return;
    const node = document.getElementById("orange-law-chart");
    if (!(node instanceof HTMLElement)) return;
    setExporting("xlsx");
    try {
      const jpeg = await renderChartJpeg(node);
      const preset = rangeWindow(range, last.t, rows[0].t);
      const tMin = zoom?.tMin ?? preset.tMin;
      const tMax = Math.min(last.t, zoom?.tMax ?? last.t);
      const liveFxNow = lastFx(rows, quote);
      const liveXauNow = lastXau(rows, quote);
      const cadScale = liveFxNow > 0 ? liveFxNow : 1;
      const table = rows
        .filter((row) => row.t >= tMin && row.t <= tMax)
        .map((row) => {
          const price = priceOf(row, currency, liveXauNow, liveFxNow);
          if (currency === "XAU") {
            return {
              iso: isoFromDay(row.t),
              price,
              fair: fairPriceXau(row.t),
              floor: quantilePriceXau(row.t, -2),
              top: quantilePriceXau(row.t, 2),
            };
          }
          return {
            iso: isoFromDay(row.t),
            price,
            fair: fairPriceUsd(row.t) * cadScale,
            floor: quantilePriceUsd(row.t, -2) * cadScale,
            top: quantilePriceUsd(row.t, 2) * cadScale,
          };
        })
        .filter((row) => row.price > 0);
      const unitLabel = currency === "XAU" ? "GOLD oz" : currency;
      await downloadChartExcel({
        rows: table,
        unitLabel,
        jpeg: jpeg.bytes,
        filename: excelExportFilename(currency, range),
        title: `Orange Law · ${unitLabel}`,
      });
    } catch {
      /* retry from the button */
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="relative z-10 min-h-dvh overflow-x-hidden pb-16 text-foreground">
      <header className="app-header sticky top-0 z-20 border-b border-border/80 bg-background/70 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 py-2 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:gap-3 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold uppercase leading-none tracking-[0.1em] text-sand sm:text-2xl sm:tracking-[0.14em] md:text-3xl">
              Orange Law
            </p>
            <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.24em] text-primary sm:mt-1 sm:text-[11px] sm:tracking-[0.32em]">
              Power Law
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Segmented<Currency>
              ariaLabel="Display currency"
              value={currency}
              onChange={setCurrency}
              size="sm"
              wrap={false}
              options={DISPLAY_CURRENCY_OPTIONS}
            />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => void exportGraph()}
                disabled={Boolean(exporting)}
                className="h-7 shrink-0 rounded-md border border-sand/30 bg-raised px-2 font-sans text-[9px] font-semibold uppercase tracking-[0.08em] text-sand transition-colors hover:border-primary hover:text-primary disabled:opacity-60 sm:h-8 sm:px-2.5 sm:text-[10px]"
              >
                {exporting === "jpeg" ? "Exporting…" : "Export Graph JPEG"}
              </button>
              <button
                type="button"
                onClick={() => void exportExcel()}
                disabled={Boolean(exporting)}
                className="h-7 shrink-0 rounded-md border border-sand/30 bg-raised px-2 font-sans text-[9px] font-semibold uppercase tracking-[0.08em] text-floor transition-colors hover:border-floor hover:text-floor disabled:opacity-60 sm:h-8 sm:px-2.5 sm:text-[10px]"
              >
                {exporting === "xlsx" ? "Exporting…" : "Export Excel Data"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-w-0 max-w-6xl flex-col gap-12 px-4 py-6 md:gap-16 md:py-8">
        <p className="max-w-4xl text-pretty text-sm leading-relaxed text-sand md:text-base md:leading-7">
          Bitcoin is not a corporation racing toward saturation and death; it is a city spreading
          like an epidemic, where users cube with time, value squares with users, and price is simply
          the network’s age raised to the sixth power.
        </p>
        <PriceHero
          price={spot}
          priceUsd={spotUsd}
          currency={currency}
          t={last?.t ?? 0}
          dayChange={liveDayChange}
        />

        <section className="select-none rounded-xl bg-card p-3 shadow-[var(--shadow-border)] md:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <h2 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-display text-xl md:text-2xl">
                <span>Scale-invariant path</span>
                <span
                  className="font-mono text-sm font-medium tabular-nums text-floor md:text-base"
                  aria-label={`R squared ${formatR2(r2)}`}
                  title="Pearson R² of log₁₀ price versus log₁₀ days since Genesis in this window"
                >
                  R² {formatR2(r2)}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Scroll or pinch to zoom. Drag to pan. Double-tap clears A–B.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented<ChartRange>
                ariaLabel="Chart range"
                value={range}
                onChange={onRange}
                size="sm"
                options={CHART_RANGE_OPTIONS}
              />
              <Button variant="outline" size="sm" onClick={onClear}>
                All-time span
              </Button>
              <Button
                type="button"
                variant={showEvents ? "secondary" : "outline"}
                size="sm"
                className="h-11"
                aria-pressed={showEvents}
                onClick={() => setShowEvents(!showEvents)}
              >
                Plot Major Events
              </Button>
              <Button
                type="button"
                variant={showFuture ? "secondary" : "outline"}
                size="sm"
                className="h-11"
                aria-pressed={showFuture}
                title="Hypothetical path: damped 4.19-year halving eigenmode, PPI/business cycle, 2028 US election"
                onClick={() => {
                  const next = !showFuture;
                  setShowFuture(next);
                  if (next) setZoom(null);
                }}
              >
                Future Projections
              </Button>
              <Button
                type="button"
                variant={historyPlay ? "secondary" : "outline"}
                size="sm"
                className="h-11"
                aria-pressed={historyPlay}
                title="Fade the path, then redraw Bitcoin’s history"
                onClick={toggleHistory}
              >
                <Disc3 className="size-4" />
                Bitcoin History
              </Button>
              <CompareMenu selected={compareIds} onToggle={toggleCompare} />
            </div>
          </div>
          <PowerChart
            rows={rows}
            currency={currency}
            liveFx={lastFx(rows, quote)}
            liveXau={lastXau(rows, quote)}
            range={range}
            zoom={zoom}
            onZoom={setZoom}
            selA={selA}
            selB={selB}
            onSelectPoint={onSelectPoint}
            onClearPoints={onClearPoints}
            buys={buys}
            showBuys={showBuys}
            buyCurrency={buyCurrency}
            events={chartEvents}
            showEvents={showEvents}
            showFuture={showFuture}
            buyEvents={buyEvents}
            compareIds={compareIds}
            historyPlay={historyPlay}
            historyEvents={historyEvents}
          />
          <RangeReturns
            currency={currency}
            liveXau={xau}
            liveFx={lastFx(rows, quote)}
            selA={selA}
            selB={selB}
            minIso={rows[0] ? isoFromDay(rows[0].t) : "2010-07-17"}
            onClear={onClear}
            onDate={onSpanDate}
          />
          <div className="mt-6 px-1">
            <SigmaCaption gold={currency === "XAU"} />
          </div>
          <PurchaseBar
            history={rows}
            spotUsd={last?.usd ?? 0}
            spotCad={last?.cad ?? 0}
          />
        </section>

        {last ? (
          <StackProjection
            tNow={last.t}
            priceNow={spot}
            fx={fx}
            currency={currency}
          />
        ) : null}

        {last ? (
          <ForwardReturns
            tNow={last.t}
            priceNow={spot}
            fx={fx}
            currency={currency}
          />
        ) : null}

        <NatureLaws />

        <ModelNotes />
      </main>
      <SiteFooter />
    </div>
  );
}
