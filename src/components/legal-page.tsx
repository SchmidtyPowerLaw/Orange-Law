import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SITE_NAME } from "@/lib/site";

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="app-header sticky top-0 z-20 border-b border-border/80 bg-background/70 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="min-w-0">
            <p className="font-display text-lg font-semibold uppercase leading-none tracking-[0.1em] text-sand">
              {SITE_NAME}
            </p>
            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-primary">
              Power Law
            </p>
          </Link>
          <Link
            to="/"
            className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground hover:text-sand"
          >
            Back to chart
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <h1 className="font-display text-3xl text-foreground md:text-4xl">{title}</h1>
        <div className="legal-copy mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
