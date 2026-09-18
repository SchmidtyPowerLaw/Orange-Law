import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DAYS_PER_YEAR,
  PROJECTED_QUANTILES,
  dateFromDay,
  daysSinceGenesis,
  quantilePriceUsd,
  quantilePriceXau,
  residualZOf,
  residualZXau,
  tFromIso,
} from "@/lib/powerlaw";
import {
  type ChartRange,
  type HistoryRow,
  type SpanPoint,
  clampTimeWindow,
  priceAtDay,
  priceOf,
  rangeWindow,
  scaleAt,
} from "@/lib/history";
import { formatBtc, formatDay, formatPrice, formatPriceCompact, formatReturn, type Currency, type FiatCurrency } from "@/lib/format";
import { buyPopDelayMs, type PlotBuy } from "@/lib/purchases";
import { eventSitsAbove, eventStroke, type PlotEvent } from "@/lib/events";
import { cn } from "@/lib/utils";
import { colorAtZ, quantizeColor } from "@/lib/band-color";
import { assetMeta, assetSeries, indexAssetToBitcoin, totalReturn, type AssetId } from "@/lib/compare";
import { futurePricePath } from "@/lib/future-path";
import { HISTORY_STILL_FADE_MS, HISTORY_STILL_SHRINK_MS, lerpRect, pathAppearMs, reelState, stillHeroMs, stillShrinkU } from "@/lib/history-reel";

type TimeWindow = { tMin: number; tMax: number };

type ChartSample = {
  point: SpanPoint;
  x: number;
  y: number;
};

type AssetFocus = {
  id: AssetId;
  t: number;
  x: number;
  y: number;
};

type Props = {
  rows: HistoryRow[];
  currency: Currency;
  liveFx: number;
  liveXau?: number;
  range: ChartRange;
  zoom: TimeWindow | null;
  onZoom: (next: TimeWindow | null) => void;
  selA: SpanPoint | null;
  selB: SpanPoint | null;
  onSelectPoint: (point: SpanPoint) => void;
  onClearPoints: () => void;
  buys?: PlotBuy[];
  showBuys?: boolean;
  buyCurrency?: FiatCurrency;
  events?: PlotEvent[];
  showEvents?: boolean;
  showFuture?: boolean;
  buyEvents?: PlotEvent[];
  compareIds?: AssetId[];
  historyPlay?: boolean;
  historyEvents?: PlotEvent[];
};

const PAD = { top: 22, right: 56, bottom: 32, left: 48 };

function placeBuys(
  buys: PlotBuy[],
  xAt: (t: number) => number,
  yAt: (p: number) => number,
  yLo: number,
  yHi: number,
): Array<PlotBuy & { x: number; y: number }> {
  const placed: Array<PlotBuy & { x: number; y: number }> = [];
  const ordered = [...buys].sort((a, b) => a.t - b.t || b.r - a.r);
  const gap = 1.6;
  const step = 1.15;
  for (const buy of ordered) {
    const x = xAt(buy.t);
    const y0 = yAt(buy.spot);
    const r = buy.r;
    let y = y0;
    for (let k = 0; k < 36; k++) {
      const offset = k === 0 ? 0 : Math.ceil(k / 2) * step * (k % 2 === 1 ? 1 : -1);
      const candidate = Math.min(yHi - r, Math.max(yLo + r, y0 + offset));
      let hit = false;
      for (const prev of placed) {
        const dx = x - prev.x;
        const dy = candidate - prev.y;
        const min = r + prev.r + gap;
        if (dx * dx + dy * dy < min * min) {
          hit = true;
          break;
        }
      }
      y = candidate;
      if (!hit) break;
    }
    placed.push({ ...buy, x, y });
  }
  return placed.sort((a, b) => b.r - a.r);
}

function logLerp(a: number, b: number, x: number) {
  return (Math.log10(x) - Math.log10(a)) / (Math.log10(b) - Math.log10(a));
}

function niceLogTicks(min: number, max: number): number[] {
  const ticks: number[] = [];
  const startExp = Math.floor(Math.log10(min));
  const endExp = Math.ceil(Math.log10(max));
  const decades = endExp - startExp;
  const multipliers = decades > 4 ? [1] : decades > 2 ? [1, 5] : [1, 2, 5];
  for (let e = startExp; e <= endExp; e++) {
    const base = 10 ** e;
    for (const m of multipliers) {
      const v = m * base;
      if (v >= min * 0.98 && v <= max * 1.02) ticks.push(v);
    }
  }
  return ticks;
}

function axisTicks(tMin: number, tMax: number): { t: number; label: string }[] {
  const span = tMax - tMin;
  if (span <= 800) {
    const stepMonths = span <= 220 ? 1 : span <= 450 ? 2 : 3;
    return monthTicks(tMin, tMax, stepMonths);
  }
  const startYear = dateFromDay(tMin).getUTCFullYear();
  const endYear = dateFromDay(tMax).getUTCFullYear();
  const spanYears = span / DAYS_PER_YEAR;
  const step = spanYears > 16 ? 2 : 1;
  const out: { t: number; label: string }[] = [];
  for (let y = startYear; y <= endYear; y++) {
    if ((y - startYear) % step !== 0 && y !== endYear) continue;
    const t = daysSinceGenesis(Date.UTC(y, 0, 1));
    if (t >= tMin && t <= tMax) out.push({ t, label: String(y) });
  }
  return out;
}

function thinAxisTicks(
  ticks: Array<{ t: number; label: string; x: number }>,
  boxW: number,
): Array<{ t: number; label: string; x: number }> {
  const compact = boxW < 640;
  const minGap = compact ? 22 : 44;
  const half = compact ? 10 : 16;
  const lo = PAD.left + (compact ? 6 : 12);
  const hi = boxW - 4 - half;
  const out: Array<{ t: number; label: string; x: number }> = [];
  for (let i = 0; i < ticks.length; i++) {
    const tick = ticks[i];
    if (tick.x < lo || tick.x > hi) continue;
    const label =
      compact && /^\d{4}$/.test(tick.label) ? `'${tick.label.slice(2)}` : tick.label;
    const next = { ...tick, label };
    if (out.length && next.x - out[out.length - 1].x < minGap) {
      if (i === ticks.length - 1) out[out.length - 1] = next;
      continue;
    }
    out.push(next);
  }
  return out;
}

function monthTicks(
  tMin: number,
  tMax: number,
  stepMonths: number,
): { t: number; label: string }[] {
  const start = dateFromDay(Math.ceil(tMin));
  const y0 = start.getUTCFullYear();
  const m0 = start.getUTCMonth();
  const out: { t: number; label: string }[] = [];
  for (let i = 0; i < 48; i++) {
    const monthIndex = m0 + i * stepMonths;
    const y = y0 + Math.floor(monthIndex / 12);
    const m = ((monthIndex % 12) + 12) % 12;
    const t = daysSinceGenesis(Date.UTC(y, m, 1));
    if (t < tMin) continue;
    if (t > tMax) break;
    const label = new Intl.DateTimeFormat("en-CA", {
      month: "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m, 1)));
    out.push({
      t,
      label: m === 0 ? `${label} ${String(y).slice(2)}` : label,
    });
  }
  return out;
}

function priceFromY(
  y: number,
  pMin: number,
  pMax: number,
  height: number,
  padTop = PAD.top,
  padBottom = PAD.bottom,
): number {
  const inner = height - padTop - padBottom;
  const u = 1 - (y - padTop) / inner;
  const clamped = Math.min(1, Math.max(0, u));
  return 10 ** (Math.log10(pMin) + clamped * (Math.log10(pMax) - Math.log10(pMin)));
}

function nearestProjectedBand(price: number, t: number, gold: boolean) {
  let best = PROJECTED_QUANTILES.find((q) => q.id === "fair") ?? PROJECTED_QUANTILES[0];
  let bestD = Infinity;
  for (const q of PROJECTED_QUANTILES) {
    const model = gold ? quantilePriceXau(t, q.z) : quantilePriceUsd(t, q.z);
    const d = Math.abs(Math.log10(model) - Math.log10(Math.max(price, 1e-8)));
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

function toPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  let d = `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += `L${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
  }
  return d;
}

type AssetLabel = {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  anchor: "start" | "end";
};

function placeAssetLabels(
  lines: Array<{ id: string; label: string; color: string; x: number; y: number }>,
  xMax: number,
  yLo: number,
  yHi: number,
  compact: boolean,
): AssetLabel[] {
  const gap = compact ? 11 : 14;
  const pad = compact ? 22 : 30;
  const ordered = [...lines].sort((a, b) => a.y - b.y);
  const out: AssetLabel[] = ordered.map((line) => {
    const nearRight = line.x > xMax - pad;
    return {
      ...line,
      tx: nearRight ? line.x - 4 : line.x + 5,
      ty: line.y,
      anchor: nearRight ? "end" : "start",
    };
  });
  for (let i = 1; i < out.length; i++) {
    if (out[i].ty - out[i - 1].ty < gap) out[i].ty = out[i - 1].ty + gap;
  }
  if (out.length > 0 && out[out.length - 1].ty > yHi) {
    out[out.length - 1].ty = yHi;
    for (let i = out.length - 2; i >= 0; i--) {
      if (out[i + 1].ty - out[i].ty < gap) out[i].ty = out[i + 1].ty - gap;
    }
  }
  for (const item of out) {
    item.ty = Math.min(yHi, Math.max(yLo, item.ty));
  }
  return out;
}

function priceColorSegments(
  points: Array<{ x: number; y: number; z: number }>,
): Array<{ d: string; color: string }> {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [{ d: toPath(points), color: quantizeColor(colorAtZ(points[0].z)) }];
  }
  const segs: Array<{ d: string; color: string }> = [];
  let color = quantizeColor(colorAtZ(points[0].z));
  let run = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const next = quantizeColor(colorAtZ(points[i].z));
    if (next === color) {
      run.push(points[i]);
      continue;
    }
    run.push(points[i]);
    segs.push({ d: toPath(run), color });
    run = [points[i]];
    color = next;
  }
  if (run.length > 0) segs.push({ d: toPath(run), color });
  return segs;
}

function bandNote(point: SpanPoint): string | null {
  if (!point.projected || !point.band) return null;
  return PROJECTED_QUANTILES.find((q) => q.id === point.band)?.short ?? null;
}

function sameSample(point: SpanPoint, other: SpanPoint | null): boolean {
  if (!other) return false;
  if (Math.abs(point.t - other.t) > 1) return false;
  if (point.projected !== other.projected) return false;
  if (point.projected) return point.band === other.band;
  return true;
}

type ChipBox = { left: number; top: number; width: number; height: number };

const CHIP_GAP = 6;
const CHIP_INSET = 6;
const CHIP_W = 102;
const CHIP_H = 28;
const CHIP_H_TAG = 34;
const CHIP_H_HOVER = 28;
const COMPARE_CHIP_W = 150;
const COMPARE_CHIP_H = 64;
const CHIP_H_EVENT = 24;
const CHIP_W_EVENT = 134;
const CHIP_H_EVENT_SM = 32;
const CHIP_W_EVENT_SM = 104;

function boxesOverlap(a: ChipBox, b: ChipBox, gap: number): boolean {
  return !(
    a.left + a.width + gap <= b.left ||
    b.left + b.width + gap <= a.left ||
    a.top + a.height + gap <= b.top ||
    b.top + b.height + gap <= a.top
  );
}

function clampChip(box: ChipBox, boxW: number, boxH: number): ChipBox {
  return {
    ...box,
    left: Math.min(boxW - box.width - CHIP_INSET, Math.max(CHIP_INSET, box.left)),
    top: Math.min(boxH - box.height - CHIP_INSET, Math.max(CHIP_INSET, box.top)),
  };
}

function chipCandidates(
  x: number,
  y: number,
  w: number,
  h: number,
  boxW: number,
  boxH: number,
): ChipBox[] {
  const o = 14;
  const raw: ChipBox[] = [
    { left: x - w / 2, top: y - h - o, width: w, height: h },
    { left: x - w / 2, top: y + o, width: w, height: h },
    { left: x + o, top: y - h / 2, width: w, height: h },
    { left: x - w - o, top: y - h / 2, width: w, height: h },
    { left: x + o, top: y - h - o, width: w, height: h },
    { left: x - w - o, top: y - h - o, width: w, height: h },
    { left: x + o, top: y + o, width: w, height: h },
    { left: x - w - o, top: y + o, width: w, height: h },
    { left: CHIP_INSET, top: CHIP_INSET, width: w, height: h },
    { left: boxW - w - CHIP_INSET, top: CHIP_INSET, width: w, height: h },
    { left: CHIP_INSET, top: boxH - h - CHIP_INSET, width: w, height: h },
    { left: boxW - w - CHIP_INSET, top: boxH - h - CHIP_INSET, width: w, height: h },
    { left: (boxW - w) / 2, top: CHIP_INSET, width: w, height: h },
    { left: (boxW - w) / 2, top: boxH - h - CHIP_INSET, width: w, height: h },
  ];
  return raw.map((item) => clampChip(item, boxW, boxH));
}

function placeChip(
  x: number,
  y: number,
  w: number,
  h: number,
  boxW: number,
  boxH: number,
  taken: ChipBox[],
): ChipBox {
  const opts = chipCandidates(x, y, w, h, boxW, boxH);
  for (const opt of opts) {
    if (taken.every((item) => !boxesOverlap(opt, item, CHIP_GAP))) return opt;
  }
  for (const col of [CHIP_INSET, boxW - w - CHIP_INSET]) {
    for (let top = CHIP_INSET; top + h <= boxH - CHIP_INSET; top += 6) {
      const opt = clampChip({ left: col, top, width: w, height: h }, boxW, boxH);
      if (taken.every((item) => !boxesOverlap(opt, item, CHIP_GAP))) return opt;
    }
  }
  return opts[0];
}

function PriceChip({
  box,
  date,
  price,
  tag,
  note,
  projected = false,
}: {
  box: ChipBox;
  date: string;
  price: string;
  tag?: string;
  note?: string | null;
  projected?: boolean;
}) {
  const kicker = tag ? (note ? `${tag} · ${note}` : tag) : note;
  return (
    <div
      className="pointer-events-none absolute z-10 leading-none"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        textShadow: "0 0 5px var(--color-ink), 0 1px 2px var(--color-ink)",
      }}
    >
      {kicker ? (
        <p
          className={cn(
            "text-[8px] font-semibold uppercase tracking-[0.12em]",
            projected ? "text-projection" : "text-muted-foreground",
          )}
        >
          {kicker}
        </p>
      ) : null}
      <p
        className={cn(
          "mt-0.5 font-mono text-[10px] tabular-nums",
          projected ? "text-projection" : "text-foreground",
        )}
      >
        {price}
      </p>
      <p className="mt-0.5 text-[8px] text-muted-foreground">{date}</p>
    </div>
  );
}

function returnTone(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) < 0.0005) return "text-muted-foreground";
  return value > 0 ? "text-up" : "text-down";
}

function CompareReturnChip({
  box,
  name,
  color,
  from,
  to,
  assetRet,
  btcRet,
}: {
  box: ChipBox;
  name: string;
  color: string;
  from: string;
  to: string;
  assetRet: number;
  btcRet: number;
}) {
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-md bg-background/80 px-2 py-1.5 leading-none shadow-[var(--shadow-border)]"
      style={{ left: box.left, top: box.top, width: box.width }}
    >
      <p className="text-[8px] font-semibold uppercase tracking-[0.12em]" style={{ color }}>
        {name} vs bitcoin
      </p>
      <p className="mt-1 text-[8px] text-muted-foreground">
        {from} → {to}
      </p>
      <p className={cn("mt-1 font-mono text-[11px] tabular-nums", returnTone(assetRet))}>
        {name} {formatReturn(assetRet)}
      </p>
      <p className={cn("mt-0.5 font-mono text-[11px] tabular-nums", returnTone(btcRet))}>
        BTC {formatReturn(btcRet)}
      </p>
    </div>
  );
}

function formatEventDate(iso: string, t: number, compact: boolean): string {
  const full = formatDay(tFromIso(iso) ?? t);
  if (!compact) return full;
  return full.replace(/^([A-Za-z]{3})\.? \d{1,2}, (\d{4})$/, "$1 $2");
}

const STILL_DOCK = 36;
const STILL_DOCK_SM = 28;

function fitStill(
  rect: { left: number; top: number; width: number; height: number },
  chartW: number,
  chartH: number,
  margin = 6,
) {
  const width = Math.max(24, Math.min(rect.width, chartW - margin * 2));
  const height = Math.max(24, Math.min(rect.height, chartH - margin * 2));
  const left = Math.min(chartW - width - margin, Math.max(margin, rect.left));
  const top = Math.min(chartH - height - margin, Math.max(margin, rect.top));
  return { left, top, width, height };
}

function dockStill(
  box: ChipBox,
  chartW: number,
  chartH: number,
  size: number,
): { left: number; top: number } {
  const right = box.left + box.width + 6;
  const leftSide = box.left - size - 6;
  const left = right + size <= chartW - 6 ? right : Math.max(6, leftSide);
  const top = box.top + (box.height - size) / 2;
  const fitted = fitStill({ left, top, width: size, height: size }, chartW, chartH);
  return { left: fitted.left, top: fitted.top };
}

function heroStillRect(chartW: number, chartH: number, compact: boolean) {
  if (compact) {
    const left = 8;
    const top = 6;
    const width = Math.min(chartW - left - 12, chartW * 0.56, 196);
    const height = Math.min(chartH * 0.34, width / 1.32, 128);
    return fitStill({ left, top, width, height }, chartW, chartH, 6);
  }
  const left = 12;
  const top = 10;
  const width = Math.min(chartW * 0.55, 620);
  const height = Math.min(chartH * 0.7, 400);
  return fitStill({ left, top, width, height }, chartW, chartH, 10);
}

function HistoryStill({
  src,
  alt,
  hero,
  left,
  top,
  width,
  height,
  opacity = 1,
}: {
  src: string;
  alt: string;
  hero: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  opacity?: number;
}) {
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={cn("history-still", hero ? "history-still-hero" : "history-still-dock")}
      style={{ left, top, width, height, opacity }}
    />
  );
}

type PlacedEvent = {
  event: PlotEvent;
  x: number;
  y: number;
  box: ChipBox;
  attachX: number;
  attachY: number;
};

function placeEventLabels(
  events: PlotEvent[],
  geo: {
    xAt: (t: number) => number;
    yAt: (p: number) => number;
    fx: (t: number) => number;
    qAt: (t: number, z: number) => number;
    tNow: number;
  },
  boxW: number,
  boxH: number,
  taken: ChipBox[],
  compact: boolean,
  padBottom: number,
  padTop = PAD.top,
): PlacedEvent[] {
  const w = compact ? CHIP_W_EVENT_SM : CHIP_W_EVENT;
  const h = compact ? CHIP_H_EVENT_SM : CHIP_H_EVENT;
  const used = [...taken];
  const out: PlacedEvent[] = [];
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const maxLeft = boxW - PAD.right - w - 4;
  const minTop = padTop > PAD.top + 8 ? padTop + 2 : CHIP_INSET;
  const plotBottom = boxH - padBottom;
  const maxTop = Math.min(plotBottom - 2, boxH - h - 2);
  const gap = compact ? 3 : 6;
  let futureI = 0;

  for (const event of sorted) {
    const x = geo.xAt(event.t);
    const yDot = geo.yAt(Math.max(event.spot, 1e-8));
    const yHi = geo.yAt(geo.qAt(event.t, 2.15));
    const yLo = geo.yAt(geo.qAt(event.t, -2.35));
    const above = eventSitsAbove(event.tone);
    const buyMark = event.tone === "cheap" || event.tone === "expensive";
    const isFuture = event.t > geo.tNow + 1;
    const stair = isFuture ? futureI++ : 0;
    const left = Math.min(
      maxLeft,
      Math.max(CHIP_INSET, x - w / 2 + stair * (compact ? 14 : 20)),
    );
    const preferred = buyMark
      ? above
        ? yDot - h - 14
        : Math.min(maxTop, yDot + (compact ? 12 : 16))
      : above
        ? Math.min(yHi, yDot) - h - 12 - stair * (compact ? 16 : 20)
        : Math.min(maxTop, Math.max(yLo, yDot) + (compact ? 14 : 20) + stair * (compact ? 14 : 18));
    const yTries = above
      ? [0, -12, -24, -36, -48, 10, 20, 32].map((d) => preferred + d)
      : [0, 8, 16, 24, 32, 40].map((d) => Math.min(maxTop, preferred + d));

    let box: ChipBox | null = null;
    for (const rawTop of yTries) {
      const next: ChipBox = {
        left,
        top: Math.min(maxTop, Math.max(minTop, rawTop)),
        width: w,
        height: h,
      };
      if (!above && !buyMark) next.top = Math.max(next.top, Math.min(maxTop, yLo + 6));
      if (used.every((item) => !boxesOverlap(next, item, gap))) {
        box = next;
        break;
      }
    }
    box ??= {
      left,
      top: Math.min(maxTop, Math.max(above || buyMark ? minTop : yLo + 6, preferred)),
      width: w,
      height: h,
    };

    used.push(box);
    const attachX = Math.min(box.left + w - 4, Math.max(box.left + 4, x));
    const attachY = above ? box.top + h : box.top;
    out.push({ event, x, y: yDot, box, attachX, attachY });
  }

  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const earlier = out[i];
      const later = out[j];
      const earlierMid = earlier.box.left + earlier.box.width / 2;
      const laterMid = later.box.left + later.box.width / 2;
      if (laterMid + 1 >= earlierMid) continue;
      const shifted = Math.min(maxLeft, Math.max(CHIP_INSET, earlierMid + 10));
      later.box = { ...later.box, left: shifted };
      later.attachX = Math.min(
        later.box.left + w - 4,
        Math.max(later.box.left + 4, later.x),
      );
    }
  }

  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      let guard = 0;
      while (boxesOverlap(out[i].box, out[j].box, gap) && guard++ < 14) {
        const stepped = out[j].box.top + (compact ? 15 : 18);
        if (stepped + out[j].box.height <= maxTop + 1) {
          out[j].box = { ...out[j].box, top: stepped };
        } else {
          out[j].box = {
            ...out[j].box,
            left: Math.min(maxLeft, out[j].box.left + (compact ? 16 : 22)),
            top: Math.min(maxTop, Math.max(minTop, out[j].box.top - (compact ? 10 : 12))),
          };
        }
        const above = eventSitsAbove(out[j].event.tone);
        out[j].attachX = Math.min(out[j].box.left + w - 4, Math.max(out[j].box.left + 4, out[j].x));
        out[j].attachY = above ? out[j].box.top + out[j].box.height : out[j].box.top;
      }
    }
  }

  return out;
}

export function PowerChart({
  rows,
  currency,
  liveFx,
  liveXau = 1800,
  range,
  zoom,
  onZoom,
  selA,
  selB,
  onSelectPoint,
  onClearPoints,
  buys = [],
  showBuys = false,
  buyCurrency = "CAD",
  events = [],
  showEvents = false,
  showFuture = false,
  buyEvents = [],
  compareIds = [],
  historyPlay = false,
  historyEvents = [],
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState({ w: 1024, h: 380 });
  const [hover, setHover] = useState<ChartSample | null>(null);
  const [assetHover, setAssetHover] = useState<AssetFocus | null>(null);
  const [assetPin, setAssetPin] = useState<AssetFocus | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{
    dist: number;
    logMin: number;
    logMax: number;
    logAnchor: number;
    u: number;
    midX: number;
  } | null>(null);
  const tap = useRef<{ id: number; x: number; y: number } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const pan = useRef<{
    id: number;
    x: number;
    logMin: number;
    logMax: number;
    active: boolean;
  } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const windowRef = useRef<TimeWindow>({ tMin: 1, tMax: 2 });
  const boundsRef = useRef<TimeWindow>({ tMin: 1, tMax: 2 });
  useEffect(() => {
    setAssetPin((pin) => (pin && compareIds.includes(pin.id) ? pin : null));
    setAssetHover((h) => (h && compareIds.includes(h.id) ? h : null));
  }, [compareIds]);

  useEffect(() => {
    if (!historyPlay) {
      setElapsed(0);
      return;
    }
    setHover(null);
    setAssetHover(null);
    setAssetPin(null);
    let cancelled = false;
    let last = performance.now();
    let acc = 0;
    setElapsed(0);
    let id = 0;
    const loop = (now: number) => {
      if (cancelled) return;
      const dt = Math.min(48, Math.max(0, now - last));
      last = now;
      acc += dt;
      setElapsed((prev) => (Math.abs(prev - acc) < 16 ? prev : acc));
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [historyPlay]);

  useEffect(() => {
    const urls = historyEvents.map((event) => event.image).filter(Boolean) as string[];
    for (const src of urls) {
      const img = new Image();
      img.src = src;
    }
  }, [historyEvents]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 40 || h < 40) return;
      setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const geo = useMemo(() => {
    if (box.w < 40 || box.h < 40 || rows.length === 0) return null;
    const tNow = rows[rows.length - 1].t;
    const compact = box.w < 640;
    const abs = historyPlay
      ? { tMin: rows[0].t, tMax: tNow }
      : rangeWindow("all", tNow, rows[0].t, { compact, future: showFuture });
    const preset = historyPlay
      ? { tMin: rows[0].t, tMax: tNow }
      : rangeWindow(range, tNow, rows[0].t, { compact, future: showFuture });
    const raw = zoom ?? preset;
    const { tMin, tMax } = clampTimeWindow(raw.tMin, raw.tMax, abs.tMin, abs.tMax);
    const eventsInView =
      (historyPlay && !compact) ||
      (showEvents && events.some((event) => event.t >= tMin && event.t <= tMax)) ||
      (showBuys && buyEvents.some((event) => event.t >= tMin && event.t <= tMax));
    const padBottom = eventsInView ? (compact ? 56 : 80) : PAD.bottom;
    const padTop = PAD.top;
    const fx = (t: number) => scaleAt(rows, t, currency, liveFx, liveXau);
    const qAt = (t: number, z: number) =>
      currency === "XAU" ? quantilePriceXau(t, z) : quantilePriceUsd(t, z) * fx(t);
    const zAt = (price: number, t: number) =>
      currency === "XAU" ? residualZXau(price, t) : residualZOf(price, t, fx(t));
    const xAt = (t: number) =>
      PAD.left +
      logLerp(tMin, tMax, Math.min(tMax, Math.max(tMin, t))) * (box.w - PAD.left - PAD.right);
    const visible = rows.filter((r) => r.t >= tMin && r.t <= tMax);
    const maxSpot = visible.reduce((m, r) => Math.max(m, priceOf(r, currency, liveXau, liveFx)), 0);
    const indexed = compareIds.map((id) => {
      const meta = assetMeta(id);
      const points = indexAssetToBitcoin(
        assetSeries(id),
        tMin,
        tMax,
        (t) => priceAtDay(rows, t, currency, liveXau, liveFx),
        (t) => fx(t),
      );
      return { id, label: meta.short, color: meta.color, points };
    });
    const qLo = qAt(tMin, currency === "XAU" ? -3.6 : -3.45);
    const floorEps = currency === "XAU" ? 1e-12 : 1e-8;
    const pMin = Math.max(floorEps, qLo > 0 ? qLo * (currency === "XAU" ? 0.32 : 0.55) : floorEps);
    const tForMax = showFuture ? tMax : Math.min(tMax, tNow + DAYS_PER_YEAR * (compact ? 1 : 3));
    const pMax = Math.max(
      qAt(tForMax, compact ? 2.1 : 2.25),
      Number.isFinite(maxSpot) ? maxSpot : 0,
    ) * (compact ? 1.06 : 1.12);
    const yAt = (p: number) => {
      const v = p > 0 ? p : pMin;
      return padTop + (1 - logLerp(pMin, pMax, v)) * (box.h - padTop - padBottom);
    };

    const samples = 160;
    const ts: number[] = [];
    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      ts.push(10 ** (Math.log10(tMin) + u * (Math.log10(tMax) - Math.log10(tMin))));
    }
    const qLine = (z: number) => ts.map((t) => ({ x: xAt(t), y: yAt(qAt(t, z)) }));
    const band = (zLo: number, zHi: number) => {
      const hi = qLine(zHi);
      const lo = qLine(zLo).slice().reverse();
      return toPath([...hi, ...lo]) + "Z";
    };

    const pricePts: { x: number; y: number; z: number }[] = [];
    let lastX = -20;
    const minDx = compact ? 1.45 : 0.7;
    for (const row of visible) {
      const x = xAt(row.t);
      if (x - lastX < minDx) continue;
      lastX = x;
      pricePts.push({
        x,
        y: yAt(priceOf(row, currency, liveXau, liveFx)),
        z: zAt(priceOf(row, currency, liveXau, liveFx), row.t),
      });
    }

    const tHi = Math.min(tNow, tMax);
    const logT0 = Math.log10(tMin);
    const logT1 = Math.log10(tHi);
    const logSpan = Math.max(1e-6, logT1 - logT0);
    const avoidX = (showEvents ? events : [])
      .filter((event) => event.tone === "bear" && event.t >= tMin && event.t <= tHi)
      .map((event) => xAt(event.t));
    const firstAvoid = avoidX.length > 0 ? Math.min(...avoidX) : Infinity;
    let floorU = 0.012;
    if (Number.isFinite(firstAvoid)) {
      for (const u of [0.01, 0.006, 0.004, 0.016, 0.02]) {
        const xTry = xAt(10 ** (logT0 + u * logSpan));
        if (xTry + 72 < firstAvoid - 70) {
          floorU = u;
          break;
        }
      }
    }
    const tFloorLabel = 10 ** (logT0 + floorU * logSpan);
    const tFloorB = Math.min(tMax, 10 ** (Math.log10(tFloorLabel) + 0.08 * (Math.log10(tMax) - Math.log10(tMin))));
    const floorAx = xAt(tFloorLabel);
    const floorAy = yAt(qAt(tFloorLabel, -2));
    const floorBx = xAt(tFloorB);
    const floorBy = yAt(qAt(tFloorB, -2));
    const floorAngle =
      (Math.atan2(floorBy - floorAy, Math.max(1e-6, floorBx - floorAx)) * 180) / Math.PI;

    return {
      padBottom,
      padTop,
      eventsInView,
      nowInView: tNow >= tMin && tNow <= tMax,
      tNow,
      tMin,
      tMax,
      abs,
      xAt,
      yAt,
      fx,
      qAt,
      pMin,
      pMax,
      bands: {
        brk: band(-3.2, -2),
        floor: band(-2, -1),
        fair: band(-1, 1),
        heat: band(1, 2),
        bubble: band(2, 2.7),
      },
      lines: {
        brk: toPath(qLine(-3)),
        floor: toPath(qLine(-2)),
        low: toPath(qLine(-1)),
        fair: toPath(qLine(0)),
        high: toPath(qLine(1)),
        top: toPath(qLine(2)),
      },
      price: toPath(pricePts),
      priceSegs: priceColorSegments(pricePts),
      futureSegs: (() => {
        if (!showFuture) return [] as Array<{ d: string; color: string }>;
        const last = rows[rows.length - 1];
        const lastPx = priceOf(last, currency, liveXau, liveFx);
        const zNow = zAt(lastPx, tNow);
        const path = futurePricePath(tNow, zNow, tMax, compact ? 8 : 5);
        const pts: { x: number; y: number; z: number }[] = [];
        let prevX = -999;
        for (const p of path) {
          if (p.t < tMin - 1) continue;
          const x = xAt(p.t);
          if (pts.length > 0 && x - prevX < 0.55) continue;
          prevX = x;
          pts.push({ x, y: yAt(qAt(p.t, p.z)), z: p.z });
        }
        return priceColorSegments(pts);
      })(),
      compare: indexed.map((line) => {
        const pts: { x: number; y: number; t: number; value: number }[] = [];
        let prevX = -20;
        for (const pt of line.points) {
          const x = xAt(pt.t);
          if (pts.length > 0 && x - prevX < 0.7) continue;
          prevX = x;
          pts.push({ x, y: yAt(pt.value), t: pt.t, value: pt.value });
        }
        const lastPt = pts.length > 0 ? pts[pts.length - 1] : null;
        return {
          id: line.id,
          label: line.label,
          color: line.color,
          d: toPath(pts),
          x: lastPt?.x ?? 0,
          y: lastPt?.y ?? 0,
          hasLabel: Boolean(lastPt),
          t0: line.points[0]?.t ?? 0,
          v0: line.points[0]?.value ?? 0,
          pts,
        };
      }),
      last: {
        x: xAt(tNow),
        y: yAt(priceOf(rows[rows.length - 1], currency, liveXau, liveFx)),
        color: colorAtZ(zAt(priceOf(rows[rows.length - 1], currency, liveXau, liveFx), tNow)),
      },
      priceTicks: niceLogTicks(pMin, pMax).map((v) => ({ v, y: yAt(v) })),
      years: thinAxisTicks(
        axisTicks(tMin, tMax).map((tick) => ({ ...tick, x: xAt(tick.t) })),
        box.w,
      ),
      edge: [
        { z: -2, text: "FLOOR", fill: "var(--chart-floor)" },
        { z: -1, text: "−1σ", fill: "var(--chart-low)" },
        { z: 0, text: "FAIR", fill: "var(--chart-fair)" },
        { z: 1, text: "+1σ", fill: "var(--chart-high)" },
        { z: 2, text: "TOP", fill: "var(--chart-top)" },
      ].map((item) => ({
        ...item,
        y: yAt(qAt(tMax, item.z)),
      })),
      floorLabel: {
        x: floorAx,
        y: floorAy,
        angle: floorAngle,
      },
    };
  }, [box, rows, currency, liveFx, liveXau, range, zoom, events, showEvents, showFuture, buyEvents, showBuys, compareIds, historyPlay]);

  windowRef.current = geo ? { tMin: geo.tMin, tMax: geo.tMax } : windowRef.current;
  boundsRef.current = geo ? geo.abs : boundsRef.current;

  const reelDomain = rows.length > 0 ? { tMin: rows[0].t, tMax: rows[rows.length - 1].t } : null;
  const reel =
    geo && historyPlay && reelDomain
      ? reelState(elapsed, reelDomain.tMin, reelDomain.tMax)
      : null;
  const bandOp = (i: number) => {
    if (!historyPlay || !reel) return 1;
    if (reel.fade > 0) return reel.fade;
    return reel.bandOn[i] ? 1 : 0;
  };
  const priceOp = !historyPlay || !reel ? 1 : reel.fade > 0 ? reel.fade : reel.drawing ? 1 : 0;
  const extraOp = !historyPlay || !reel ? 1 : reel.fade;
  const clipW = geo && reel && reel.drawing && !reel.done ? Math.max(PAD.left, geo.xAt(reel.revealT)) : null;
  const nowMark =
    !historyPlay || !reel
      ? true
      : reel.fade > 0.04 || (reel.drawing && reel.revealT >= (geo?.tNow ?? 0) - 0.5);
  const nowMarkOp = historyPlay && reel && reel.fade > 0 ? reel.fade : 1;

  const applyWindow = (tMin: number, tMax: number) => {
    const next = clampTimeWindow(tMin, tMax, boundsRef.current.tMin, boundsRef.current.tMax);
    onZoom(next);
  };

  const panByLog = (logMin: number, logMax: number, dLog: number) => {
    let nextMin = logMin + dLog;
    let nextMax = logMax + dLog;
    const absLo = Math.log10(boundsRef.current.tMin);
    const absHi = Math.log10(boundsRef.current.tMax);
    if (nextMin < absLo) {
      nextMax += absLo - nextMin;
      nextMin = absLo;
    }
    if (nextMax > absHi) {
      nextMin -= nextMax - absHi;
      nextMax = absHi;
    }
    if (nextMin < absLo) nextMin = absLo;
    applyWindow(10 ** nextMin, 10 ** nextMax);
  };

  const zoomAt = (clientX: number, factor: number) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const inner = rect.width - PAD.left - PAD.right;
    const u = Math.min(1, Math.max(0, (clientX - rect.left - PAD.left) / inner));
    const { tMin, tMax } = windowRef.current;
    const logMin = Math.log10(tMin);
    const logMax = Math.log10(tMax);
    const span = (logMax - logMin) * factor;
    const logAnchor = logMin + u * (logMax - logMin);
    const nextMin = 10 ** (logAnchor - u * span);
    const nextMax = 10 ** (logAnchor - u * span + span);
    applyWindow(nextMin, nextMax);
  };

  const sampleAt = (
    clientX: number,
    clientY: number,
    currentTarget: SVGSVGElement,
  ): ChartSample | null => {
    if (!geo || rows.length === 0) return null;
    const rect = currentTarget.getBoundingClientRect();
    const xPx = clientX - rect.left;
    const yPx = clientY - rect.top;
    const inner = rect.width - PAD.left - PAD.right;
    const u = Math.min(1, Math.max(0, (xPx - PAD.left) / inner));
    const tRaw = 10 ** (Math.log10(geo.tMin) + u * (Math.log10(geo.tMax) - Math.log10(geo.tMin)));
    const t = Math.min(geo.tMax, Math.max(geo.tMin, tRaw));

    if (t <= geo.tNow + 0.4) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].t < geo.tMin || rows[i].t > geo.tMax) continue;
        const d = Math.abs(rows[i].t - t);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      const row = rows[best];
      const point: SpanPoint = { t: row.t, usd: row.usd, cad: row.cad, xau: row.xau, projected: false };
      return { point, x: geo.xAt(row.t), y: geo.yAt(priceOf(point, currency, liveXau, liveFx)) };
    }

    const tProj = Math.round(t);
    const displayPrice = priceFromY(yPx, geo.pMin, geo.pMax, box.h, geo.padTop, geo.padBottom);
    const gold = currency === "XAU";
    const scale = Math.max(geo.fx(tProj), 1e-12);
    const modelGuess = gold ? displayPrice : displayPrice / scale;
    const band = nearestProjectedBand(modelGuess, tProj, gold);
    const usd = gold ? quantilePriceXau(tProj, band.z) * (liveXau > 0 ? liveXau : 1) : quantilePriceUsd(tProj, band.z);
    const cad = usd * liveFx;
    const point: SpanPoint = { t: tProj, usd, cad, xau: liveXau, projected: true, band: band.id };
    return { point, x: geo.xAt(tProj), y: geo.yAt(priceOf(point, currency, liveXau, liveFx)) };
  };

  const hitAsset = (clientX: number, clientY: number, svg: SVGSVGElement): AssetFocus | null => {
    if (!geo || geo.compare.length === 0) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    const x = ((clientX - rect.left) / rect.width) * box.w;
    const y = ((clientY - rect.top) / rect.height) * box.h;
    const thresh = box.w < 640 ? 22 : 14;
    let best: AssetFocus | null = null;
    let bestD = thresh;
    for (const line of geo.compare) {
      for (const pt of line.pts) {
        const d = Math.hypot(pt.x - x, pt.y - y);
        if (d <= bestD) {
          bestD = d;
          best = { id: line.id, t: pt.t, x: pt.x, y: pt.y };
        }
      }
    }
    return best;
  };

  const selectAt = (clientX: number, clientY: number, currentTarget: SVGSVGElement) => {
    const sample = sampleAt(clientX, clientY, currentTarget);
    if (sample) onSelectPoint(sample.point);
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY) + 0.5) {
        const { tMin, tMax } = windowRef.current;
        const inner = Math.max(1, (svgRef.current?.clientWidth ?? box.w) - PAD.left - PAD.right);
        const dLog = (ev.deltaX / inner) * (Math.log10(tMax) - Math.log10(tMin));
        panByLog(Math.log10(tMin), Math.log10(tMax), dLog);
        return;
      }
      const factor = Math.exp(ev.deltaY * 0.0016);
      zoomAt(ev.clientX, factor);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const onPointerDown = (ev: React.PointerEvent<SVGSVGElement>) => {
    ev.preventDefault();
    try {
      ev.currentTarget.setPointerCapture(ev.pointerId);
    } catch {
      /* synthetic or already captured */
    }
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.current.size === 1 && geo) {
      tap.current = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
      pinch.current = null;
      pan.current = {
        id: ev.pointerId,
        x: ev.clientX,
        logMin: Math.log10(geo.tMin),
        logMax: Math.log10(geo.tMax),
        active: false,
      };
      return;
    }
    tap.current = null;
    pan.current = null;
    setGrabbing(false);
    if (pointers.current.size === 2 && geo) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (dist < 8) return;
      const rect = ev.currentTarget.getBoundingClientRect();
      const inner = rect.width - PAD.left - PAD.right;
      const midX = (pts[0].x + pts[1].x) / 2;
      const u = Math.min(1, Math.max(0, (midX - rect.left - PAD.left) / inner));
      const logMin = Math.log10(geo.tMin);
      const logMax = Math.log10(geo.tMax);
      pinch.current = {
        dist,
        logMin,
        logMax,
        logAnchor: logMin + u * (logMax - logMin),
        u,
        midX,
      };
    }
  };

  const onPointerMove = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (pointers.current.has(ev.pointerId)) {
      pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    }
    const gesture = pinch.current;
    if (pointers.current.size >= 2 && gesture) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (dist < 8) return;
      const rect = ev.currentTarget.getBoundingClientRect();
      const inner = rect.width - PAD.left - PAD.right;
      const midX = (pts[0].x + pts[1].x) / 2;
      const scale = gesture.dist / dist;
      const span = (gesture.logMax - gesture.logMin) * scale;
      const pan = ((midX - gesture.midX) / inner) * (gesture.logMax - gesture.logMin);
      const logMin = gesture.logAnchor - gesture.u * span - pan;
      applyWindow(10 ** logMin, 10 ** (logMin + span));
      setHover(null);
      setAssetHover(null);
      return;
    }
    const start = tap.current;
    const drag = pan.current;
    if (pointers.current.size === 1 && drag && drag.id === ev.pointerId) {
      const dx = Math.abs(ev.clientX - drag.x);
      if (!drag.active && dx > 8) {
        drag.active = true;
        tap.current = null;
        setGrabbing(true);
        setHover(null);
      }
      if (drag.active) {
        const rect = ev.currentTarget.getBoundingClientRect();
        const inner = Math.max(1, rect.width - PAD.left - PAD.right);
        const dLog = -((ev.clientX - drag.x) / inner) * (drag.logMax - drag.logMin);
        panByLog(drag.logMin, drag.logMax, dLog);
        setHover(null);
        setAssetHover(null);
        return;
      }
    }
    if (start && start.id === ev.pointerId) {
      const moved = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
      if (moved > 14) tap.current = null;
    }
    if (ev.pointerType === "mouse" || ev.pointerType === "pen") {
      const hit = hitAsset(ev.clientX, ev.clientY, ev.currentTarget);
      if (hit) {
        setAssetHover(hit);
        setHover(null);
      } else {
        setAssetHover(null);
        setHover(sampleAt(ev.clientX, ev.clientY, ev.currentTarget));
      }
    }
  };

  const onPointerUp = (ev: React.PointerEvent<SVGSVGElement>) => {
    const start = tap.current;
    pointers.current.delete(ev.pointerId);
    try {
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    } catch {
      /* already released */
    }
    if (pointers.current.size < 2) pinch.current = null;
    if (start && start.id === ev.pointerId && pointers.current.size === 0) {
      const moved = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
      tap.current = null;
      if (moved > 14) return;
      const now = performance.now();
      const prev = lastTap.current;
      if (
        prev &&
        now - prev.t < 340 &&
        Math.hypot(ev.clientX - prev.x, ev.clientY - prev.y) < 28
      ) {
        lastTap.current = null;
        if (selA || selB) onClearPoints();
        else onZoom(null);
        return;
      }
      lastTap.current = { t: now, x: ev.clientX, y: ev.clientY };
      const hit = hitAsset(start.x, start.y, ev.currentTarget);
      if (hit) {
        setAssetPin((prev) =>
          prev && prev.id === hit.id && Math.abs(prev.t - hit.t) < 12 ? null : hit,
        );
        return;
      }
      setAssetPin(null);
      selectAt(start.x, start.y, ev.currentTarget);
    }
  };

  const onDoubleClick = (ev: React.MouseEvent<SVGSVGElement>) => {
    ev.preventDefault();
    lastTap.current = null;
    if (selA || selB) onClearPoints();
    else onZoom(null);
  };

  const a = selA;
  const b = selB;
  const projectedSpan = Boolean(a?.projected || b?.projected);
  const placedBuys =
    !historyPlay && showBuys && geo
      ? placeBuys(
          buys.filter((buy) => buy.t >= geo.tMin && buy.t <= geo.tMax),
          geo.xAt,
          geo.yAt,
          geo.padTop,
          box.h - geo.padBottom,
        )
      : [];

  const aVisible = Boolean(geo && a && a.t >= geo.tMin && a.t <= geo.tMax);
  const bVisible = Boolean(geo && b && b.t >= geo.tMin && b.t <= geo.tMax);
  const chipTaken: ChipBox[] = [];
  const aChip =
    geo && aVisible && a
      ? placeChip(
          geo.xAt(a.t),
          geo.yAt(priceOf(a, currency, liveXau, liveFx)),
          CHIP_W,
          CHIP_H_TAG,
          box.w,
          box.h,
          chipTaken,
        )
      : null;
  if (aChip) chipTaken.push(aChip);
  const bChip =
    geo && bVisible && b
      ? placeChip(
          geo.xAt(b.t),
          geo.yAt(priceOf(b, currency, liveXau, liveFx)),
          CHIP_W,
          CHIP_H_TAG,
          box.w,
          box.h,
          chipTaken,
        )
      : null;
  if (bChip) chipTaken.push(bChip);
  const visibleEvents = geo
    ? historyPlay
      ? reel && reel.drawing
        ? historyEvents.filter((event) => event.t <= reel.revealT && event.t >= geo.tMin)
        : []
      : [
          ...(showEvents ? events : []),
          ...(showBuys ? buyEvents : []),
        ].filter((event) => event.t >= geo.tMin && event.t <= geo.tMax)
    : [];
  const compactChart = box.w < 640;
  const heroRect = heroStillRect(box.w, box.h, compactChart);
  const placedEvents =
    geo && visibleEvents.length > 0
      ? placeEventLabels(
          visibleEvents,
          geo,
          box.w,
          box.h,
          chipTaken,
          compactChart,
          geo.padBottom,
          historyPlay && compactChart ? heroRect.top + heroRect.height + 8 : geo.padTop,
        )
      : [];
  for (const item of placedEvents) chipTaken.push(item.box);
  const stills = (() => {
    if (!historyPlay || !reel || !geo) return [];
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const size = compactChart ? STILL_DOCK_SM : STILL_DOCK;
    const heroMs = stillHeroMs(compactChart);
    const lore = placedEvents.filter((item) => item.event.image);
    const out: Array<{
      key: string;
      src: string;
      alt: string;
      hero: boolean;
      left: number;
      top: number;
      width: number;
      height: number;
      opacity: number;
    }> = [];
    const takenDocks: ChipBox[] = [];
    let nextFree = 0;
    for (const item of lore) {
      let at = pathAppearMs(item.event.t, geo.tMin, Math.min(geo.tNow, geo.tMax));
      if (at < nextFree) at = nextFree;
      nextFree = at + heroMs;
      if (elapsed < at) continue;
      const age = elapsed - at;
      // Desktop keeps every still after it shrinks. Mobile fades extras so the
      // small chart stays readable; Giovanni's law still stays docked.
      const keepDocked = !compactChart || Boolean(item.event.image?.includes("giovanni-power-law"));
      const goneAt = heroMs + HISTORY_STILL_SHRINK_MS + HISTORY_STILL_FADE_MS;
      if (!keepDocked && age >= goneAt) continue;
      const fadeAge = age - heroMs - HISTORY_STILL_SHRINK_MS;
      const opacity =
        keepDocked || fadeAge <= 0 ? 1 : Math.max(0, 1 - fadeAge / HISTORY_STILL_FADE_MS);
      let dock = dockStill(item.box, box.w, box.h, size);
      for (let i = 0; i < 10; i++) {
        const next: ChipBox = { left: dock.left, top: dock.top, width: size, height: size };
        if (!takenDocks.some((taken) => boxesOverlap(taken, next, 4))) break;
        dock = {
          left: dock.left,
          top: Math.min(box.h - size - 6, dock.top + size + 4),
        };
      }
      takenDocks.push({ left: dock.left, top: dock.top, width: size, height: size });
      const u = stillShrinkU(age, heroMs, reduce);
      const rect = lerpRect(heroRect, { left: dock.left, top: dock.top, width: size, height: size }, u);
      out.push({
        key: item.event.iso,
        src: item.event.image!,
        alt: item.event.label,
        hero: u < 1,
        opacity,
        ...rect,
      });
    }
    return out;
  })();
  const hoverVisible = Boolean(
    geo && hover && !sameSample(hover.point, a) && !sameSample(hover.point, b) && !assetHover && !assetPin,
  );
  const hoverChip =
    geo && hoverVisible && hover
      ? placeChip(hover.x, hover.y, CHIP_W, CHIP_H_HOVER, box.w, box.h, chipTaken)
      : null;
  const assetLabels =
    geo
      ? placeAssetLabels(
          geo.compare.filter((line) => line.hasLabel),
          box.w - PAD.right,
          geo.padTop + 8,
          box.h - geo.padBottom - 8,
          box.w < 640,
        )
      : [];
  const compareFocus = (() => {
    if (!geo) return null;
    const raw = assetPin ?? assetHover;
    if (!raw) return null;
    const line = geo.compare.find((item) => item.id === raw.id);
    if (!line || line.pts.length === 0) return null;
    let pt = line.pts[0];
    let best = Infinity;
    for (const p of line.pts) {
      const d = Math.abs(p.t - raw.t);
      if (d < best) {
        best = d;
        pt = p;
      }
    }
    return {
      line,
      pt,
      assetRet: totalReturn(line.v0, pt.value),
      btcRet: totalReturn(
        priceAtDay(rows, line.t0, currency, liveXau, liveFx),
        priceAtDay(rows, pt.t, currency, liveXau, liveFx),
      ),
    };
  })();
  const compareChip =
    geo && compareFocus
      ? placeChip(
          compareFocus.pt.x,
          compareFocus.pt.y,
          COMPARE_CHIP_W,
          COMPARE_CHIP_H,
          box.w,
          box.h,
          chipTaken,
        )
      : null;

  return (
    <>
      {showEvents && !historyPlay ? (
        <p className="mb-2 rounded-md bg-down/15 px-3 py-2 text-center text-xs leading-snug text-down md:text-sm">
          Bear Markets begin shortly after a new order of magnitude in price is hit ex: $10; $100; $1,000; $10,000; $100,000
        </p>
      ) : null}
      {historyPlay ? (
        <p className="mb-2 rounded-md bg-primary/15 px-3 py-2 text-center text-xs leading-snug text-sand md:text-sm">
          2009 — Genesis troll. Block 0 quotes the Times: “Chancellor on brink of second bailout for banks.”
        </p>
      ) : null}
      <div
        ref={wrapRef}
        id="orange-law-chart"
        className="power-chart relative w-full overflow-hidden rounded-lg bg-card"
        onPointerLeave={() => {
          setHover(null);
          setAssetHover(null);
        }}
      >
      {geo ? (
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${box.w} ${box.h}`}
          preserveAspectRatio="none"
          className={cn(
            "block touch-none select-none",
            grabbing ? "cursor-grabbing" : assetHover ? "cursor-pointer" : "cursor-grab",
          )}
          role="img"
          aria-label="Bitcoin log-log power law chart with quantile bands and the power law floor"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        >
          <defs>
            <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {clipW != null ? (
              <clipPath id="history-reveal">
                <rect x={0} y={0} width={clipW} height={box.h} />
              </clipPath>
            ) : null}
          </defs>
          <path d={geo.bands.brk} className="band-break" opacity={bandOp(0)} />
          <path d={geo.bands.floor} className="band-floor" opacity={bandOp(1)} />
          <path d={geo.bands.fair} className="band-fair" opacity={bandOp(2)} />
          <path d={geo.bands.heat} className="band-heat" opacity={bandOp(3)} />
          <path d={geo.bands.bubble} className="band-bubble" opacity={bandOp(4)} />

          {geo.priceTicks.map((tick) => (
            <g key={tick.v}>
              <line
                x1={PAD.left}
                x2={box.w - PAD.right}
                y1={tick.y}
                y2={tick.y}
                className="chart-grid-stroke"
                stroke="var(--chart-grid)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={tick.y}
                textAnchor="end"
                dominantBaseline="middle"
                className="chart-tick"
              >
                {formatPriceCompact(tick.v, currency)}
              </text>
            </g>
          ))}

          {geo.years.map((tick) => (
            <g key={tick.label + tick.t}>
              <line
                x1={tick.x}
                x2={tick.x}
                y1={geo.padTop}
                y2={box.h - geo.padBottom}
                stroke="var(--chart-grid)"
                strokeWidth={1}
              />
              <text
                x={tick.x}
                y={geo.eventsInView ? box.h - 11 : box.h - geo.padBottom + 16}
                textAnchor="middle"
                className="chart-tick"
              >
                {tick.label}
              </text>
            </g>
          ))}

          <path
            d={geo.lines.brk}
            fill="none"
            stroke="var(--chart-break)"
            strokeWidth={1}
            strokeDasharray="3 5"
            opacity={bandOp(0)}
          />
          <path
            d={geo.lines.low}
            fill="none"
            stroke="var(--chart-low)"
            strokeWidth={1.2}
            opacity={bandOp(2)}
          />
          <path
            d={geo.lines.fair}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={1.6}
            opacity={bandOp(2)}
          />
          <path
            d={geo.lines.high}
            fill="none"
            stroke="var(--chart-high)"
            strokeWidth={1.2}
            opacity={bandOp(3)}
          />
          <path
            d={geo.lines.top}
            fill="none"
            stroke="var(--color-destructive)"
            strokeWidth={1.2}
            strokeDasharray="5 4"
            opacity={bandOp(4)}
          />
          <path
            d={geo.lines.floor}
            fill="none"
            stroke="var(--chart-floor)"
            strokeWidth={5}
            strokeOpacity={0.28}
            strokeLinecap="round"
            opacity={bandOp(1)}
          />
          <path
            d={geo.lines.floor}
            fill="none"
            stroke="var(--chart-floor)"
            strokeWidth={3.2}
            strokeLinecap="round"
            filter="url(#cyanGlow)"
            opacity={bandOp(1)}
          />

          {geo.nowInView && nowMark ? (
          <line
            x1={geo.last.x}
            x2={geo.last.x}
            y1={geo.padTop}
            y2={box.h - geo.padBottom}
            stroke="var(--chart-today)"
            strokeWidth={1}
            strokeDasharray="2 4"
            opacity={nowMarkOp}
          />
          ) : null}

          {a && b ? (
            <rect
              x={Math.min(geo.xAt(a.t), geo.xAt(b.t))}
              y={geo.padTop}
              width={Math.abs(geo.xAt(a.t) - geo.xAt(b.t))}
              height={box.h - geo.padTop - geo.padBottom}
              fill={projectedSpan ? "var(--color-projection)" : "var(--color-foreground)"}
              fillOpacity={0.08}
            />
          ) : null}

          {!historyPlay
            ? geo.compare.map((line) => (
            <path
              key={line.id}
              d={line.d}
              fill="none"
              stroke={line.color}
              strokeWidth={2.05}
              strokeLinejoin="round"
              strokeLinecap="round"
              pointerEvents="none"
              opacity={0.92 * extraOp}
            />
          ))
            : null}
          {!historyPlay
            ? assetLabels.map((item) => (
            <g key={`lbl-${item.id}`} pointerEvents="none" opacity={extraOp}>
              {Math.abs(item.ty - item.y) > 2 ? (
                <line
                  x1={item.x}
                  y1={item.y}
                  x2={item.tx}
                  y2={item.ty}
                  stroke={item.color}
                  strokeWidth={0.8}
                  opacity={0.55}
                />
              ) : null}
              <text
                x={item.tx}
                y={item.ty}
                textAnchor={item.anchor}
                dominantBaseline="middle"
                fill={item.color}
                stroke="var(--color-background)"
                strokeWidth={3.2}
                paintOrder="stroke"
                className="chart-asset-label"
              >
                {item.label}
              </text>
            </g>
          ))
            : null}

          <g
            opacity={priceOp}
            clipPath={clipW != null ? "url(#history-reveal)" : undefined}
          >
          {geo.priceSegs.map((seg, i) => (
            <path
              key={i}
              d={seg.d}
              fill="none"
              stroke={seg.color}
              strokeWidth={2.15}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          </g>
          {!historyPlay
            ? geo.futureSegs.map((seg, i) => (
            <path
              key={`fut-${i}`}
              d={seg.d}
              fill="none"
              stroke={seg.color}
              strokeWidth={2.15}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.5}
              pointerEvents="none"
            />
          ))
            : null}

          {placedBuys.map((buy) => (
            <circle
              key={`${buy.iso}-${buy.t}`}
              className="buy-dot"
              cx={buy.x}
              cy={buy.y}
              r={buy.r}
              fill="var(--color-purchase)"
              fillOpacity={0.82}
              stroke="var(--color-ink)"
              strokeWidth={0.85}
              pointerEvents="none"
              style={{ animationDelay: `${buyPopDelayMs(placedBuys, buy.t)}ms` }}
            >
              <title>
                {`${buy.iso} · ${formatPrice(buy.amount, buyCurrency)} · ${formatBtc(buy.btc)}`}
              </title>
            </circle>
          ))}

          {placedEvents.map((item) => {
            const fill = eventStroke(item.event.tone);
            const desktop = box.w >= 640;
            const cx = item.box.left + item.box.width / 2;
            const date = formatEventDate(item.event.iso, item.event.t, !desktop);
            return (
              <g
                key={`${item.event.iso}-${item.event.tone}`}
                pointerEvents="none"
                className={historyPlay ? "event-enter" : undefined}
              >
                <line
                  x1={item.x}
                  y1={item.y}
                  x2={item.attachX}
                  y2={item.attachY}
                  stroke={fill}
                  strokeWidth={1}
                />
                <circle
                  cx={item.x}
                  cy={item.y}
                  r={3.25}
                  fill={fill}
                  stroke="#0c0c0c"
                  strokeWidth={1}
                />
                <text
                  x={cx}
                  y={item.box.top + (desktop ? 10 : 8)}
                  textAnchor="middle"
                  fill={fill}
                  stroke="#0c0c0c"
                  strokeWidth={desktop ? 3.4 : 2.8}
                  paintOrder="stroke"
                  fontFamily='IBM Plex Mono, ui-monospace, "SF Mono", Menlo, monospace'
                  fontSize={desktop ? 10 : 8}
                  fontWeight={500}
                >
                  <tspan x={cx} dy={0}>
                    {item.event.label}
                  </tspan>
                  <tspan x={cx} dy={desktop ? 12 : 10} fontSize={desktop ? 8 : 6.5}>
                    {date}
                  </tspan>
                </text>
              </g>
            );
          })}

          {geo.nowInView && nowMark && priceOp > 0.05 ? (
          <circle
            cx={geo.last.x}
            cy={geo.last.y}
            r={4.5}
            fill={geo.last.color}
            stroke="var(--color-card)"
            strokeWidth={2}
            opacity={nowMarkOp}
          />
          ) : null}

          {a && a.t >= geo.tMin && a.t <= geo.tMax ? (
            <SelMark geo={geo} point={a} currency={currency} liveXau={liveXau} liveFx={liveFx} />
          ) : null}
          {b && b.t >= geo.tMin && b.t <= geo.tMax ? (
            <SelMark geo={geo} point={b} currency={currency} liveXau={liveXau} liveFx={liveFx} />
          ) : null}

          {hover ? (
            <g pointerEvents="none">
              <line
                x1={hover.x}
                x2={hover.x}
                y1={geo.padTop}
                y2={box.h - geo.padBottom}
                stroke={hover.point.projected ? "var(--color-projection)" : "var(--color-foreground)"}
                strokeOpacity={0.4}
                strokeWidth={1}
              />
              <line
                x1={PAD.left}
                x2={box.w - PAD.right}
                y1={hover.y}
                y2={hover.y}
                stroke={hover.point.projected ? "var(--color-projection)" : "var(--color-foreground)"}
                strokeOpacity={0.18}
                strokeWidth={1}
              />
              <circle
                cx={hover.x}
                cy={hover.y}
                r={4.5}
                fill={hover.point.projected ? "var(--color-projection)" : "var(--color-primary)"}
                stroke="var(--color-card)"
                strokeWidth={2}
              />
            </g>
          ) : null}
          {compareFocus ? (
            <circle
              cx={compareFocus.pt.x}
              cy={compareFocus.pt.y}
              r={4.5}
              fill={compareFocus.line.color}
              stroke="var(--color-card)"
              strokeWidth={2}
              pointerEvents="none"
            />
          ) : null}

          {geo.edge.map((item) => (
            <text
              key={item.text}
              x={box.w - PAD.right + 8}
              y={item.y}
              dominantBaseline="middle"
              fill={item.fill}
              className="chart-edge"
              opacity={bandOp(
                item.z <= -2 ? 1 : item.z <= -1 ? 2 : item.z <= 0 ? 2 : item.z <= 1 ? 3 : 4,
              )}
            >
              {item.text}
            </text>
          ))}

          {!historyPlay ? (
          <text
            x={PAD.left}
            y={12}
            className="chart-kicker"
          >
            log–log · days since Genesis
          </text>
          ) : null}
          {geo.nowInView && nowMark ? (
          <text
            x={Math.min(geo.last.x - 8, box.w - PAD.right - 4)}
            y={geo.padTop + 2}
            textAnchor="end"
            dominantBaseline="hanging"
            fill="var(--chart-today)"
            className="chart-kicker"
            opacity={nowMarkOp}
          >
            today
          </text>
          ) : null}
          <text
            transform={`translate(${geo.floorLabel.x} ${geo.floorLabel.y}) rotate(${geo.floorLabel.angle.toFixed(2)})`}
            className="chart-floor-label"
            opacity={bandOp(1)}
          >
            <tspan x={4} y={11}>POWER LAW</tspan>
            <tspan x={4} y={22}>FLOOR</tspan>
          </text>
        </svg>
      ) : null}
      {geo && a && aChip ? (
        <PriceChip
          box={aChip}
          tag="A"
          date={formatDay(a.t)}
          price={formatPrice(priceOf(a, currency, liveXau, liveFx), currency)}
          note={bandNote(a)}
          projected={a.projected}
        />
      ) : null}
      {geo && b && bChip ? (
        <PriceChip
          box={bChip}
          tag="B"
          date={formatDay(b.t)}
          price={formatPrice(priceOf(b, currency, liveXau, liveFx), currency)}
          note={bandNote(b)}
          projected={b.projected}
        />
      ) : null}
      {stills.map((still) => (
        <HistoryStill
          key={still.key}
          src={still.src}
          alt={still.alt}
          hero={still.hero}
          left={still.left}
          top={still.top}
          width={still.width}
          height={still.height}
          opacity={still.opacity}
        />
      ))}
      {geo && compareFocus && compareChip ? (
        <CompareReturnChip
          box={compareChip}
          name={compareFocus.line.label}
          color={compareFocus.line.color}
          from={formatDay(compareFocus.line.t0)}
          to={formatDay(compareFocus.pt.t)}
          assetRet={compareFocus.assetRet}
          btcRet={compareFocus.btcRet}
        />
      ) : null}
      {geo && hover && hoverChip ? (
        <PriceChip
          box={hoverChip}
          date={formatDay(hover.point.t)}
          price={formatPrice(priceOf(hover.point, currency, liveXau, liveFx), currency)}
          note={bandNote(hover.point)}
          projected={hover.point.projected}
        />
      ) : null}
      <p className="sr-only" aria-live="polite">
        {hover
          ? `${formatDay(hover.point.t)} ${formatPrice(priceOf(hover.point, currency, liveXau, liveFx), currency)}`
          : ""}
      </p>
    </div>
    </>
  );
}

function SelMark({
  geo,
  point,
  currency,
  liveXau,
  liveFx,
}: {
  geo: {
    xAt: (t: number) => number;
    yAt: (p: number) => number;
  };
  point: SpanPoint;
  currency: Currency;
  liveXau: number;
  liveFx: number;
}) {
  const x = geo.xAt(point.t);
  const y = geo.yAt(priceOf(point, currency, liveXau, liveFx));
  const fill = point.projected ? "var(--color-projection)" : "var(--color-foreground)";
  return (
    <g>
      <line
        x1={x}
        x2={x}
        y1={PAD.top}
        y2={y}
        stroke={fill}
        strokeOpacity={0.75}
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <circle
        cx={x}
        cy={y}
        r={4}
        fill={fill}
        stroke="var(--color-card)"
        strokeWidth={1.5}
      />
    </g>
  );
}
