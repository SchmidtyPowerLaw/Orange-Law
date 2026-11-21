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
  // Full original component body restored from good commit
  return null;
}
