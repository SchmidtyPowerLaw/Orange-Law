import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BETA, R_SQUARED, SIGMA } from "@/lib/powerlaw";
import { GIOVANNI_X, PAPER_URL, SITE_EMAIL } from "@/lib/site";

function CreditLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline decoration-primary/50 underline-offset-2 transition-colors hover:text-sand hover:decoration-sand"
    >
      {children}
    </a>
  );
}

export function ModelNotes() {
  return (
    <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        The law
      </p>
      <h2 className="mt-2 font-display text-2xl text-foreground">
        P(t) ∼ t<sup className="text-lg">β</sup>
      </h2>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
        Santostasi and Perrenod show the exponent is not a free fit. Address
        growth scales as t<sup>3.05</sup> (epidemic spread on a scale-free
        network) and price scales as N<sup>1.84</sup> (generalised Metcalfe).
        Their product is the observed β.
      </p>
      <dl className="mt-5 grid grid-cols-3 gap-3 font-mono text-sm">
        <div className="rounded-md bg-raised px-3 py-3">
          <dt className="text-xs text-muted-foreground">β</dt>
          <dd className="mt-1 text-lg tabular-nums text-primary">{BETA.toFixed(2)}</dd>
        </div>
        <div className="rounded-md bg-raised px-3 py-3">
          <dt className="text-xs text-muted-foreground">σ</dt>
          <dd className="mt-1 text-lg tabular-nums">{SIGMA.toFixed(3)} dex</dd>
        </div>
        <div className="rounded-md bg-raised px-3 py-3">
          <dt className="text-xs text-muted-foreground">R²</dt>
          <dd className="mt-1 text-lg tabular-nums">{R_SQUARED.toFixed(3)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Fit on daily closes from 17 July 2010 (day 560 after Genesis) through
        February 2026. Floor is the −2σ quantile; a year below −3σ is the
        published falsification test. CAD and GOLD are the USD power law
        expressed at the latest FX / gold print, so the path and quantile
        bands stay aligned (cycle tops on +2σ) and the scale-invariant slope
        does not bend. Native CAD and gold still feed the live day-over-day
        change. Compare overlays use Yahoo
        Finance adjusted closes (S&P 500 total return, XIC.TO for the
        TSX, CNQ.TO, NVDA, AAPL, COST) converted into the selected unit the
        same way bitcoin is, then indexed to bitcoin's price at the left
        edge of the view so each line is the growth of the same starting
        dollar.
      </p>
      <p className="mt-4 max-w-prose text-xs leading-relaxed text-muted-foreground">
        Model by{" "}
        <CreditLink href={GIOVANNI_X}>Giovanni Santostasi</CreditLink>
        {" · "}
        <CreditLink href={GIOVANNI_X}>@Giovann35084111</CreditLink>
        . Paper with Stephen Perrenod:{" "}
        <CreditLink href={PAPER_URL}>
          A Mechanistic Derivation of the Bitcoin Price Power Law
        </CreditLink>
        .
      </p>
      <p className="mt-3 max-w-prose text-xs leading-relaxed text-muted-foreground">
        Independent educational chart — not affiliated with Giovanni. Questions:{" "}
        <a
          href={`mailto:${SITE_EMAIL}`}
          className="text-primary underline decoration-primary/50 underline-offset-2 hover:text-sand"
        >
          {SITE_EMAIL}
        </a>
        {" · "}
        <Link
          to="/about"
          className="text-primary underline decoration-primary/50 underline-offset-2 hover:text-sand"
        >
          About
        </Link>
        {" · "}
        <Link
          to="/privacy"
          className="text-primary underline decoration-primary/50 underline-offset-2 hover:text-sand"
        >
          Privacy
        </Link>
        .
      </p>
    </section>
  );
}
