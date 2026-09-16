import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  RACE_HORSES,
  RACE_TRILLION,
  RACE_X_MAX,
  RACE_Y_MAX,
  RACE_Y_MIN,
  moneyTick,
  racePath,
} from "@/lib/trillion-race";

const PAD = { top: 28, right: 22, bottom: 36, left: 52 };

function logLerp(a: number, b: number, x: number) {
  return (Math.log10(x) - Math.log10(a)) / (Math.log10(b) - Math.log10(a));
}

function linLerp(a: number, b: number, x: number) {
  return (x - a) / (b - a);
}

function yTicks(): number[] {
  const ticks: number[] = [];
  for (let e = 6; e <= 12; e++) ticks.push(10 ** e);
  return ticks;
}

export function TrillionRace() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 540 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const compact = box.w < 640;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 8 && r.height > 8) setBox({ w: r.width, h: r.height });
    };
    read();
    const obs = new ResizeObserver(read);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const geo = useMemo(() => {
    const pad = compact ? { top: 24, right: 14, bottom: 34, left: 44 } : PAD;
    const xAt = (t: number) => pad.left + linLerp(0, RACE_X_MAX, t) * (box.w - pad.left - pad.right);
    const yAt = (m: number) =>
      pad.top + (1 - logLerp(RACE_Y_MIN, RACE_Y_MAX, Math.min(RACE_Y_MAX, Math.max(RACE_Y_MIN, m)))) * (box.h - pad.top - pad.bottom);
    const lines = RACE_HORSES.map((horse) => ({
      horse,
      d: racePath(horse.points, xAt, yAt),
      end: horse.points[horse.points.length - 1]!,
    }));
    const xTickYears = compact ? [0, 10, 20, 30, 40] : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45];
    return {
      pad,
      xAt,
      yAt,
      lines,
      xTicks: xTickYears.filter((t) => t <= RACE_X_MAX).map((t) => ({ t, x: xAt(t) })),
      yTicks: yTicks().map((v) => ({ v, y: yAt(v) })),
    };
  }, [box, compact]);

  const labels = useMemo(() => {
    const ordered = [...geo.lines].sort((a, b) => a.end.t - b.end.t);
    const placed: Array<{
      id: string;
      fx: number;
      fy: number;
      x: number;
      ty: number;
      w: number;
      h: number;
      color: string;
      name: string;
      years: string;
    }> = [];
    const yFinish = geo.yAt(RACE_TRILLION);
    const lineH = compact ? 22 : 26;
    const gap = compact ? 24 : 28;
    const minX = geo.pad.left + 8;
    const maxX = box.w - geo.pad.right - 4;
    const minTy = geo.pad.top + (compact ? 12 : 14);
    const baseTy = yFinish - (compact ? 18 : 22);
    const hits = (x: number, ty: number, w: number, h: number) =>
      placed.some((p) => x - w < p.x + 6 && x + 6 > p.x - p.w && ty < p.ty + p.h && ty + h > p.ty);

    for (const line of ordered) {
      const fx = geo.xAt(line.end.t);
      const fy = geo.yAt(line.end.mcap);
      const w = Math.max(line.horse.name.length, line.horse.yearsLabel.length) * (compact ? 5.6 : 6.5) + 4;
      const h = lineH;
      let x = Math.min(Math.max(fx - 8, minX + w), maxX);
      let ty = baseTy;
      while (ty > minTy + 1 && hits(x, ty, w, h)) ty -= gap;
      if (hits(x, ty, w, h)) {
        x = Math.max(minX + w, x - (compact ? 56 : 70));
        ty = baseTy;
        while (ty > minTy + 1 && hits(x, ty, w, h)) ty -= gap;
      }
      ty = Math.max(minTy, Math.min(baseTy, ty));
      placed.push({
        id: line.horse.id,
        fx,
        fy,
        x,
        ty,
        w,
        h,
        color: line.horse.color,
        name: line.horse.name,
        years: line.horse.yearsLabel,
      });
    }
    return placed;
  }, [geo, compact, box.w, box.h]);

  const hitHorse = (clientX: number, clientY: number, svg: SVGSVGElement) => {
    const rect = svg.getBoundingClientRect();
    if (rect.width < 1) return null;
    const x = ((clientX - rect.left) / rect.width) * box.w;
    const y = ((clientY - rect.top) / rect.height) * box.h;
    let best: string | null = null;
    let bestD = 18;
    for (const line of geo.lines) {
      const t = (x - geo.pad.left) / Math.max(1, box.w - geo.pad.left - geo.pad.right);
      const years = t * RACE_X_MAX;
      let nearest = line.horse.points[0]!;
      let nd = Infinity;
      for (const p of line.horse.points) {
        const d = Math.abs(p.t - years);
        if (d < nd) {
          nd = d;
          nearest = p;
        }
      }
      const d = Math.hypot(geo.xAt(nearest.t) - x, geo.yAt(nearest.mcap) - y);
      if (d < bestD) {
        bestD = d;
        best = line.horse.id;
      }
    }
    return best;
  };

  return (
    <section className="min-w-0 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] md:p-6">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        The $1 trillion club
      </p>
      <h2 className="mt-2 font-display text-2xl text-foreground">
        What is the Fastest Horse In the Race?
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
        Clock starts at founding — Genesis for Bitcoin. Each line is market cap from first public
        print until the first close at $1 trillion. Bitcoin is the orange used above.
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
          aria-label="Years from founding to a one trillion dollar market cap"
          onPointerMove={(ev) => {
            if (ev.pointerType !== "mouse") return;
            setHoverId(hitHorse(ev.clientX, ev.clientY, ev.currentTarget));
          }}
          onPointerLeave={() => setHoverId(null)}
        >
          <defs>
            <filter id="raceBtcGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {geo.yTicks.map((tick) => (
            <g key={`y-${tick.v}`}>
              <line
                x1={geo.pad.left}
                x2={box.w - geo.pad.right}
                y1={tick.y}
                y2={tick.y}
                stroke="var(--color-border)"
                strokeOpacity={tick.v === RACE_TRILLION ? 0.9 : 0.5}
                strokeDasharray={tick.v === RACE_TRILLION ? "5 4" : undefined}
              />
              <text x={geo.pad.left - 8} y={tick.y + 3} textAnchor="end" className="chart-tick">
                {moneyTick(tick.v)}
              </text>
            </g>
          ))}
          {geo.xTicks.map((tick) => (
            <g key={`x-${tick.t}`}>
              <line
                x1={tick.x}
                x2={tick.x}
                y1={geo.pad.top}
                y2={box.h - geo.pad.bottom}
                stroke="var(--color-border)"
                strokeOpacity={0.4}
              />
              <text x={tick.x} y={box.h - 14} textAnchor="middle" className="chart-tick">
                {tick.t}
              </text>
            </g>
          ))}
          <text x={geo.pad.left} y={14} className="chart-kicker">
            USD market cap (log)
          </text>
          <text x={box.w / 2} y={box.h - 2} textAnchor="middle" className="chart-kicker">
            years since founding / Genesis
          </text>

          <line
            x1={geo.pad.left}
            x2={box.w - geo.pad.right}
            y1={geo.yAt(RACE_TRILLION)}
            y2={geo.yAt(RACE_TRILLION)}
            stroke="var(--color-sand)"
            strokeOpacity={0.35}
            strokeDasharray="6 5"
          />
          <text
            x={geo.pad.left + 6}
            y={geo.yAt(RACE_TRILLION) - 6}
            className="chart-kicker"
            fill="var(--color-sand)"
          >
            $1 trillion
          </text>

          {geo.lines.map((line) => {
            const btc = line.horse.id === "btc";
            const dim = hoverId != null && hoverId !== line.horse.id;
            const hot = hoverId === line.horse.id;
            return (
              <path
                key={line.horse.id}
                d={line.d}
                fill="none"
                stroke={line.horse.color}
                strokeWidth={btc ? (hot ? 4.2 : 3.6) : hot ? 3 : 2.1}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={dim ? 0.18 : 1}
                filter={btc ? "url(#raceBtcGlow)" : undefined}
              />
            );
          })}

          {labels.map((item) => (
            <g
              key={`lbl-${item.id}`}
              pointerEvents="none"
              opacity={hoverId && hoverId !== item.id ? 0.22 : 1}
            >
              {Math.hypot(item.x - item.fx, item.ty - item.fy) > 4 ? (
                <line
                  x1={item.fx}
                  y1={item.fy}
                  x2={item.x}
                  y2={item.ty}
                  stroke={item.color}
                  strokeWidth={0.8}
                  opacity={0.5}
                />
              ) : null}
              <circle cx={item.fx} cy={item.fy} r={item.id === "btc" ? 3.4 : 2.6} fill={item.color} />
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
                  {item.name}
                </tspan>
                <tspan x={item.x} dy={compact ? 9 : 12}>
                  {item.years}
                </tspan>
              </text>
            </g>
          ))}
        </svg>
      </div>

      <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {RACE_HORSES.map((horse) => (
          <li
            key={horse.id}
            className="flex min-w-0 items-center gap-1.5 rounded-lg bg-raised px-2.5 py-2 sm:gap-2 sm:px-3"
            onPointerEnter={() => setHoverId(horse.id)}
            onPointerLeave={() => setHoverId(null)}
          >
            <span className="min-w-0 truncate text-[13px] font-medium sm:text-sm" style={{ color: horse.color }}>
              {horse.name}
            </span>
            {horse.logo ? (
              <img
                src={horse.logo}
                alt=""
                width={24}
                height={24}
                className="h-5 w-5 shrink-0 object-contain sm:h-6 sm:w-6"
              />
            ) : null}
            <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground sm:text-xs">
              {horse.yearsLabel}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
