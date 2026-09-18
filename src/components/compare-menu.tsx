import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMPARE_ASSETS, type AssetId } from "@/lib/compare";
import { cn } from "@/lib/utils";

type Props = {
  selected: AssetId[];
  onToggle: (id: AssetId) => void;
};

function viewportBox() {
  const vv = window.visualViewport;
  return {
    left: vv?.offsetLeft ?? 0,
    width: vv?.width ?? window.innerWidth,
    top: vv?.offsetTop ?? 0,
  };
}

export function CompareMenu({ selected, onToggle }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const active = selected.length > 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent | TouchEvent) => {
      const t = ev.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    const onClose = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("orientationchange", onClose);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("orientationchange", onClose);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const btn = wrapRef.current;
    const menu = menuRef.current;
    if (!btn || !menu) return;

    const place = () => {
      const box = btn.getBoundingClientRect();
      const view = viewportBox();
      const pad = 8;
      const maxW = Math.max(160, view.width - pad * 2);
      const width = Math.min(288, maxW);
      const viewLeft = view.left + pad;
      const viewRight = view.left + view.width - pad;
      let left = view.width < 640 ? box.left : box.right - width;
      if (left + width > viewRight) left = viewRight - width;
      if (left < viewLeft) left = viewLeft;
      menu.style.width = `${width}px`;
      menu.style.left = `${left}px`;
      menu.style.right = "auto";
      menu.style.top = `${box.bottom + 4}px`;
      menu.style.maxHeight = `${Math.max(160, window.innerHeight - box.bottom - 16)}px`;
    };

    place();
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
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
      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="group"
              aria-label="Comparison assets"
              className="fixed z-50 overflow-y-auto rounded-lg bg-raised p-2 shadow-[var(--shadow-border)]"
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
