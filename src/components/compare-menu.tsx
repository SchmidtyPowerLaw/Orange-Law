import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMPARE_ASSETS, type AssetId } from "@/lib/compare";
import { cn } from "@/lib/utils";

type Props = {
  selected: AssetId[];
  onToggle: (id: AssetId) => void;
};

export function CompareMenu({ selected, onToggle }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const active = selected.length > 0;

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
    <div ref={wrapRef} className="relative">
      <Button
        type="button"
        variant={active ? "secondary" : "outline"}
        size="sm"
        className="h-11"
        aria-pressed={active}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        Compare to Other Assets
        {active ? (
          <span className="rounded-sm bg-primary/20 px-1.5 font-mono text-[10px] text-primary">
            {selected.length}
          </span>
        ) : null}
        <ChevronDown className={cn("size-3.5 opacity-70 transition-transform", open && "rotate-180")} />
      </Button>
      {open ? (
        <div
          role="group"
          aria-label="Comparison assets"
          className="absolute right-0 z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg bg-raised p-2 shadow-[var(--shadow-border)]"
        >
          <p className="px-2 pb-1.5 pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Growth of the same starting dollar as bitcoin in this window
          </p>
          {COMPARE_ASSETS.map((asset) => {
            const on = selected.includes(asset.id);
            return (
              <label
                key={asset.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted",
                  on && "bg-muted",
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-primary)]"
                  checked={on}
                  onChange={() => onToggle(asset.id)}
                />
                <span
                  className="h-0.5 w-4 shrink-0 rounded-full"
                  style={{ background: asset.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block leading-none text-sand">{asset.label}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{asset.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
