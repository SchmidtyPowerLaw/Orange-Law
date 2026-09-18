import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE_NAME, TREZOR_AFFILIATE_URL } from "@/lib/site";

export function TrezorCustody() {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
      <div className="grid items-center gap-6 p-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:gap-8 md:p-6">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Self-custody
          </p>
          <h2 className="mt-2 font-display text-2xl text-foreground">Hold the keys</h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            The power law only helps if you still hold the coins. A hardware wallet keeps
            the keys offline — Trezor built the first one, and it still only signs what
            you confirm on the screen.
          </p>
          <ul className="mt-4 space-y-1.5 text-sm text-sand">
            <li>Keys stay on the device, not on an exchange.</li>
            <li>Open-source firmware you can verify.</li>
            <li>Ships from Trezor — not a reseller.</li>
          </ul>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button asChild>
              <a
                href={TREZOR_AFFILIATE_URL}
                target="_blank"
                rel="sponsored noopener noreferrer"
              >
                Get a Trezor
                <ArrowUpRight />
              </a>
            </Button>
            <p className="max-w-[20rem] text-[11px] leading-snug text-muted-foreground">
              Affiliate link — {SITE_NAME} may earn a commission if you buy. Same price
              to you.
            </p>
          </div>
        </div>
        <a
          href={TREZOR_AFFILIATE_URL}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="flex justify-center md:justify-end"
          aria-label="Get a Trezor hardware wallet"
        >
          <img
            src="/trezor.png"
            alt="Trezor Safe 5 hardware wallet"
            className="h-auto w-full max-w-[280px] object-contain sm:max-w-[320px]"
            width={640}
            height={640}
          />
        </a>
      </div>
    </section>
  );
}
