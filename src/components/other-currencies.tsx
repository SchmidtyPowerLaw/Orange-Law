import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isOtherCode, OTHER_CURRENCY_OPTIONS, type OtherCode } from "@/lib/fx";
import type { Currency } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  value: Currency;
  onChange: (currency: Currency) => void;
};

export function OtherCurrenciesMenu({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const active = isOtherCode(value);
  const selected = active ? OTHER_CURRENCY_OPTIONS.find((item) => item.value === value) : null;

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

  const pick = (code: OtherCode) => {
    onChange(code);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
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
        Other Currencies
        {active ? (
          <span className="rounded-sm bg-primary/20 px-1.5 font-mono text-[10px] text-primary">
            {selected?.label ?? value}
          </span>
        ) : null}
        <ChevronDown className={cn("size-3.5 opacity-70 transition-transform", open && "rotate-180")} />
      </Button>
      {open ? (
        <div
          role="listbox"
          aria-label="Other currencies"
          className="absolute right-0 z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg bg-raised p-2 shadow-[var(--shadow-border)]"
        >
          <p className="px-2 pb-1.5 pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Bitcoin priced in each day’s FX vs USD — not a frozen conversion
          </p>
          {OTHER_CURRENCY_OPTIONS.map((item) => {
            const on = value === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={on}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted",
                  on && "bg-muted",
                )}
                onClick={() => pick(item.value)}
              >
                <span className="w-10 shrink-0 font-mono text-xs text-primary">{item.label}</span>
                <span className="min-w-0 flex-1">
                  <span className="block leading-none text-sand">{item.name}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
