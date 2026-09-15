import { cn } from "@/lib/utils";

type Option<T extends string> = {
  value: T;
  label: string;
  icon?: string;
  iconWide?: boolean;
};

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  ariaLabel: string;
  size?: "default" | "sm";
  wrap?: boolean;
  className?: string;
};

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = "default",
  wrap = true,
  className,
}: Props<T>) {
  const compact = size === "sm";
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex rounded-lg bg-muted p-1 shadow-[var(--shadow-border)]",
        wrap ? "max-w-full flex-wrap" : "shrink-0 flex-nowrap",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center justify-center gap-0.5 rounded-md font-medium leading-none transition-[background-color,color,box-shadow] duration-150 ease-out sm:gap-1",
              compact
                ? "h-8 min-w-0 px-1.5 text-[10px] sm:h-9 sm:px-2 sm:text-[11px] md:h-11 md:px-2.5 md:text-xs"
                : "h-11 min-w-11 px-3 text-sm",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.icon ? (
              <img
                src={opt.icon}
                alt=""
                width={opt.iconWide ? 32 : 20}
                height={18}
                draggable={false}
                aria-hidden="true"
                className={cn(
                  "pointer-events-none shrink-0 object-contain",
                  opt.iconWide
                    ? compact
                      ? "h-3.5 w-7 sm:h-4 sm:w-8 md:h-4 md:w-10"
                      : "h-4 w-10"
                    : compact
                      ? "h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-6"
                      : "h-5 w-6",
                )}
              />
            ) : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
