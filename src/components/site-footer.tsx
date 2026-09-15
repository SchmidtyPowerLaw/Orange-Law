import { Link } from "@tanstack/react-router";
import { SITE_EMAIL, SITE_NAME } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/80 bg-background/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          {SITE_NAME} is an independent educational chart of Bitcoin’s power
          law. Not financial advice.
        </p>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Site">
          <Link to="/" className="hover:text-sand">
            Chart
          </Link>
          <Link to="/about" className="hover:text-sand">
            About
          </Link>
          <Link to="/privacy" className="hover:text-sand">
            Privacy
          </Link>
          <a href={`mailto:${SITE_EMAIL}`} className="hover:text-sand">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
