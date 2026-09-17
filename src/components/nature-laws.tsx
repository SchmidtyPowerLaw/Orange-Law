import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  NATURE_LAWS,
  NATURE_X_MAX,
  NATURE_X_MIN,
  naturePath,
  natureSeries,
  type NatureLaw,
  type NatureLawId,
} from "@/lib/nature-laws";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_IDS = NATURE_LAWS.filter((l) => l.id !== "kleiber").map((l) => l.id);

function logLerp(a: number, b: number, x: number) {
  return (Math.log10(x) - Math.log10(a)) / (Math.log10(b) - Math.log10(a));
}

function decadeTicks(min: number, max: number, maxCount = 8): number[] {
  const ticks: number[] = [];
  const a = Math.ceil(Math.log10(min) - 1e-9);
  const b = Math.floor(Math.log10(max) + 1e-9);
  for (let e = a; e <= b; e++) ticks.push(10 ** e);
  if (ticks.length <= maxCount) return ticks;
  const step = Math.ceil(ticks.length / maxCount);
  return ticks.filter((_, i) => i % step === 0 || i === ticks.length - 1);
}

function sci(v: number): string {
  if (v === 0) return "0";
  const e = Math.round(Math.log10(v));
  if (e === 0) return "1";
  return `10${toSuper(e)}`;
}

function toSuper(n: number): string {
  const map: Record<string, string> = {
    "-": "⁻",
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
  };
  return String(n)
    .split("")
    .map((c) => map[c] ?? c)
    .join("");
}

function LawsMenu({
  selected,
  onToggle,
}: {
  selected: NatureLawId[];
  onToggle: (id: NatureLawId) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const count = selected.length;

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      if (!wrapRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative w-full min-w-0 sm:w-auto sm:shrink-0">
      <Button
        type="button"
        variant={count > 0 ? "secondary" : "outline"}
        size="sm"
        className="h-11 w-full sm:w-auto"
        aria-pressed={count > 0}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        Show laws
        <span className="rounded-sm bg-primary/20 px-1.5 font-mono text-[10px] text-primary">{count}</span>
        <ChevronDown className={cn("size-3.5 opacity-70 transition-transform", open && "rotate-180")} />
      </Button>
      {open ? (
        <div
          role="group"
          aria-label="Power laws to plot"
          className="absolute left-0 right-0 z-30 mt-1 w-auto max-w-full rounded-lg bg-raised p-2 shadow-[var(--shadow-border)] sm:left-auto sm:right-0 sm:w-[22rem] sm:max-w-[calc(100vw-2rem)]"
        >
          {NATURE_LAWS.map((law) => {
            const on = selected.includes(law.id);
            return (
              <label
                key={law.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted",
                  on && "bg-muted",
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-primary)]"
                  checked={on}
                  onChange={() => onToggle(law.id)}
                />
                <span className="h-0.5 w-4 shrink-0 rounded-full" style={{ background: law.color }} aria-hidden />
                <span className="min-w-0 break-words leading-snug text-sand">{law.name}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function NatureLaws() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 1024, h: 380 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const tapRef = useRef<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<NatureLawId[]>(DEFAULT_IDS);
  const activeId = focusId ?? hoverId;

  const toggle = (id: NatureLawId) => {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };
  const toggleFocus = (id: string) => {
    setFocusId((cur) => (cur === id ? null : id));
  };

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

  const compact = box.w < 640;
  const pad = { top: 18, right: compact ? 8 : 176, bottom: 32, left: compact ? 34 : 48 };

  const geo = useMemo(() => {
    const active = NATURE_LAWS.filter((law) => selected.includes(law.id));
    const series = active.map((law) => ({ law, pts: natureSeries(law) }));
    let yMin = Infinity;
    let yMax = 0;
    for (const s of series) {
      for (const p of s.pts) {
        if (p.y < yMin) yMin = p.y;
        if (p.y > yMax) yMax = p.y;
      }
    }
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMin <= 0) {
      yMin = 1e-9;
      yMax = 1;
    }
    const pMin = yMin * 0.35;
    const pMax = yMax * 2.2;
    const xAt = (x: number) =>
      pad.left + logLerp(NATURE_X_MIN, NATURE_X_MAX, x) * (box.w - pad.left - pad.right);
    const yAt = (y: number) =>
      pad.top + (1 - logLerp(pMin, pMax, Math.max(pMin, y))) * (box.h - pad.top - pad.bottom);
    const lines = series.map((s) => ({
      ...s,
      d: naturePath(s.pts, xAt, yAt),
      end: s.pts[s.pts.length - 1],
    }));
    const xTicks = decadeTicks(NATURE_X_MIN, NATURE_X_MAX).map((v) => ({ v, x: xAt(v) }));
    const yTicks = decadeTicks(pMin, pMax).map((v) => ({ v, y: yAt(v) }));
    return { pMin, pMax, xAt, yAt, lines, xTicks, yTicks, pad };
  }, [box, selected, compact, pad.left, pad.right]);

  const labels = useMemo(() => {
    const innerTop = geo.pad.top + 14;
    const innerBot = box.h - geo.pad.bottom - 16;
    const ordered = [...geo.lines].sort((a, b) => geo.yAt(a.end.y) - geo.yAt(b.end.y));
    const placed: Array<{
      id: string;
      x: number;
      y: number;
      ty: number;
      color: string;
      line1: string;
      line2: string;
    }> = [];
    const gap = compact ? 28 : 32;
    for (const line of ordered) {
      const y0 = geo.yAt(line.end.y);
      const prev = placed[placed.length - 1];
      let ty = y0;
      if (prev && ty - prev.ty < gap) ty = prev.ty + gap;
      ty = Math.min(innerBot, Math.max(innerTop, ty));
      placed.push({
        id: line.law.id,
        x: geo.xAt(line.end.x) - 4,
        y: y0,
        ty,
        color: line.law.color,
        line1: line.law.line1,
        line2: line.law.line2,
      });
    }
    return placed;
  }, [geo, box, compact]);

  const hitLaw = (
    clientX: number,
    clientY: number,
    svg: SVGSVGElement,
    maxDist = 16,
  ): NatureLaw | null => {
    const rect = svg.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    const x = ((clientX - rect.left) / rect.width) * box.w;
    const y = ((clientY - rect.top) / rect.height) * box.h;
    const u = (x - geo.pad.left) / Math.max(1, box.w - geo.pad.left - geo.pad.right);
    const t = 10 ** (
      Math.log10(NATURE_X_MIN) +
      Math.min(1, Math.max(0, u)) * (Math.log10(NATURE_X_MAX) - Math.log10(NATURE_X_MIN))
    );
    let best: NatureLaw | null = null;
    let bestD = maxDist;
    for (const line of geo.lines) {
      const yy = geo.yAt(line.law.intercept * t ** line.law.exponent);
      const d = Math.abs(yy - y);
      if (d < bestD) {
        bestD = d;
        best = line.law;
      }
    }
    return best;
  };

  return (
    <section className="min-w-0 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] md:p-6">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Scale-free nature
          </p>
          <h2 className="mt-2 font-display text-2xl text-foreground">More Power Laws in Nature</h2>
        </div>
        <LawsMenu selected={selected} onToggle={toggle} />
      </div>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
        Same log-log plane as Bitcoin. Each line is y = A x<sup>β</sup> with the exponent from the
        source paper — slope is the law. Zipf, city rank-size, and Bitcoin’s on-chain wealth tail
        sit near β = −1. Kleiber rises; Pareto and Gutenberg–Richter decay at other slopes.
      </p>

      <div
        ref={wrapRef}
        className="nature-chart relative mt-5 -mx-9 h-[min(72svh,780px)] min-h-[min(560px,85svh)] w-[calc(100%+4.5rem)] overflow-hidden rounded-none bg-card md:mx-0 md:h-[540px] md:min-h-[540px] md:w-full md:rounded-lg"
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${box.w} ${box.h}`}
          preserveAspectRatio="none"
          className="block cursor-pointer touch-manipulation"
          role="img"
          aria-label="Log-log chart of power laws in nature"
          onPointerDown={(ev) => {
            tapRef.current = { x: ev.clientX, y: ev.clientY };
          }}
          onPointerMove={(ev) => {
            if (ev.pointerType !== "mouse") return;
            const law = hitLaw(ev.clientX, ev.clientY, ev.currentTarget);
            setHoverId(law?.id ?? null);
          }}
          onPointerUp={(ev) => {
            const start = tapRef.current;
            tapRef.current = null;
            if (!start) return;
            if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 14) return;
            const law = hitLaw(ev.clientX, ev.clientY, ev.currentTarget, 26);
            setFocusId((cur) => {
              if (!law) return null;
              return cur === law.id ? null : law.id;
            });
          }}
          onPointerLeave={() => {
            tapRef.current = null;
            setHoverId(null);
          }}
        >
          <defs>
            <filter id="btcGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {geo.yTicks.map((t) => (
            <g key={`y-${t.v}`}>
              <line
                x1={geo.pad.left}
                x2={box.w - geo.pad.right}
                y1={t.y}
                y2={t.y}
                stroke="var(--color-border)"
                strokeOpacity={0.55}
              />
              <text x={geo.pad.left - 8} y={t.y + 3} textAnchor="end" className="chart-tick">
                {sci(t.v)}
              </text>
            </g>
          ))}
          {geo.xTicks.map((t) => (
            <g key={`x-${t.v}`}>
              <line
                x1={t.x}
                x2={t.x}
                y1={geo.pad.top}
                y2={box.h - geo.pad.bottom}
                stroke="var(--color-border)"
                strokeOpacity={0.45}
              />
              <text x={t.x} y={box.h - 12} textAnchor="middle" className="chart-tick">
                {sci(t.v)}
              </text>
            </g>
          ))}
          <text x={geo.pad.left} y={14} className="chart-kicker">
            relative y (native units, log)
          </text>
          <text x={box.w / 2} y={box.h - 2} textAnchor="middle" className="chart-kicker">
            relative scale x (log)
          </text>

          {geo.lines.map((line) => {
            const on = activeId == null || activeId === line.law.id;
            const btc = line.law.id === "btc";
            const hot = activeId === line.law.id;
            return (
              <path
                key={line.law.id}
                d={line.d}
                fill="none"
                stroke={line.law.color}
                strokeWidth={btc ? (hot ? 4.2 : 3.6) : hot ? 3.1 : 2.15}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={on ? 1 : 0.18}
                filter={btc ? "url(#btcGlow)" : undefined}
              />
            );
          })}

          {labels.map((item) => (
            <g key={`lbl-${item.id}`} pointerEvents="none" opacity={activeId && activeId !== item.id ? 0.25 : 1}>
              {Math.abs(item.ty - item.y) > 2 ? (
                <line
                  x1={item.x}
                  y1={item.y}
                  x2={item.x}
                  y2={item.ty}
                  stroke={item.color}
                  strokeWidth={0.8}
                  opacity={0.5}
                />
              ) : null}
              <text
                x={item.x}
                y={item.ty}
                textAnchor="end"
                fill={item.color}
                stroke="var(--color-background)"
                strokeWidth={3.2}
                paintOrder="stroke"
                className="chart-asset-label"
              >
                <tspan x={item.x} dy={0}>
                  {item.line1}
                </tspan>
                <tspan x={item.x} dy={compact ? 9 : 12}>
                  {item.line2}
                </tspan>
              </text>
            </g>
          ))}
        </svg>
      </div>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {NATURE_LAWS.map((law) => (
          <li
            key={law.id}
            role="button"
            tabIndex={0}
            aria-pressed={activeId === law.id}
            className={cn(
              "cursor-pointer touch-manipulation rounded-lg bg-raised px-3 py-3 select-none",
              selected.includes(law.id) ? "opacity-100" : "opacity-45",
              activeId === law.id && "shadow-[var(--shadow-border-hover)]",
            )}
            onPointerEnter={() => setHoverId(law.id)}
            onPointerLeave={() => setHoverId(null)}
            onClick={() => toggleFocus(law.id)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                toggleFocus(law.id);
              }
            }}
          >
            <p className="text-xs font-medium uppercase tracking-[0.12em]" style={{ color: law.color }}>
              {law.name}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{law.citation}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
