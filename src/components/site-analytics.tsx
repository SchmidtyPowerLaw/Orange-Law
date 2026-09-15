import { Analytics } from "@vercel/analytics/react";
import { useRouterState } from "@tanstack/react-router";

function shouldSend(host: string) {
  if (!host) return false;
  if (host === "localhost" || host.startsWith("127.") || host.endsWith(".local")) return false;
  if (host.endsWith("grok.me")) return false;
  return true;
}

export function SiteAnalytics() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <Analytics
      mode="production"
      path={pathname}
      beforeSend={(event) => {
        const host = typeof window === "undefined" ? "" : window.location.hostname;
        return shouldSend(host) ? event : null;
      }}
    />
  );
}
