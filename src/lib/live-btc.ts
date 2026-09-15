import { useEffect, useState } from "react";
import type { LiveQuote } from "@/lib/history";
import { getLiveTick, type LiveTick } from "@/lib/quote";

export type { LiveTick };

export function withLiveTick(quote: LiveQuote, tick: LiveTick): LiveQuote {
  const usd = tick.usd > 0 ? tick.usd : quote.usd;
  const cad = tick.cad > 0 ? tick.cad : usd * (quote.fx > 0 ? quote.fx : 1);
  const xau = tick.xau > 0 ? tick.xau : quote.xau;
  return {
    ...quote,
    usd,
    cad,
    xau,
    fx: usd > 0 && cad > 0 ? cad / usd : quote.fx,
    asOf: new Date().toISOString(),
  };
}

export function useLiveTick(): LiveTick | null {
  const [tick, setTick] = useState<LiveTick | null>(null);

  useEffect(() => {
    let alive = true;
    let pollId = 0;

    const apply = (next: LiveTick) => {
      if (!alive || !(next.usd > 0)) return;
      setTick((prev) => {
        if (
          prev &&
          Math.abs(prev.usd - next.usd) < 0.05 &&
          Math.abs(prev.cad - next.cad) < 0.05 &&
          Math.abs(prev.xau - next.xau) < 0.05
        ) {
          return prev;
        }
        return next;
      });
    };

    const pollOnce = async () => {
      try {
        apply(await getLiveTick());
      } catch {
        /* keep last tick */
      }
    };

    void pollOnce();
    pollId = window.setInterval(() => {
      if (alive && document.visibilityState === "visible") void pollOnce();
    }, 3000);

    const onVis = () => {
      if (document.visibilityState === "visible") void pollOnce();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
      if (pollId) window.clearInterval(pollId);
    };
  }, []);

  return tick;
}
