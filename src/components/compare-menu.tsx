import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const menuRef = useRef<HTMLDivElement>(null);
  const active = selected.length > 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      if (!wrapRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    const onClose = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const btn = wrapRef.current;
    const menu = menuRef.current;
    if (!btn || !menu) return;
    const box = btn.getBoundingClientRect();
    const pad = 12;
    const width = Math.min(menu.offsetWidth || 288, window.innerWidth - pad * 2);
    let left = box.right - width;
    if (left < pad) left = pad;
    if (left + width > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - pad - width);
    menu.style.width = `${width}px`;
    menu.style.left = `${left}px`;
    menu.style.top = `${box.bottom + 4}px`;
    menu.style.right = "auto";
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
          ref={menuRef}
          role="group"
          aria-label="Comparison assets"
          className="fixed z-40 w-72 max-w-[calc(100vw-1.5rem)] rounded-lg bg-raised p-2 shadow-[var(--shadow-border)]"
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
