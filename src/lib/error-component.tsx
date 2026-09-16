import { useEffect } from "react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
const RELOAD_KEY = "ol-chunk-reload";
const RELOAD_WINDOW_MS = 12_000;

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

function isStaleChunkError(error: unknown): boolean {
  const msg = errorMessage(error);
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk \S+ failed|Unable to preload CSS/i.test(
    msg,
  );
}

function recentReload(): boolean {
  if (typeof window === "undefined") return false;
  const raw = sessionStorage.getItem(RELOAD_KEY);
  const at = raw ? Number(raw) : 0;
  return Number.isFinite(at) && Date.now() - at < RELOAD_WINDOW_MS;
}

function hardReload() {
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  const url = new URL(window.location.href);
  url.searchParams.set("_ol", String(Date.now()));
  window.location.replace(url.pathname + url.search + url.hash);
}

export function ChunkLoadRecovery() {
  useEffect(() => {
    const raw = sessionStorage.getItem(RELOAD_KEY);
    const at = raw ? Number(raw) : 0;
    if (at && Date.now() - at > RELOAD_WINDOW_MS) sessionStorage.removeItem(RELOAD_KEY);
    const url = new URL(window.location.href);
    if (url.searchParams.has("_ol")) {
      url.searchParams.delete("_ol");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
    const onPreload = (event: Event) => {
      event.preventDefault();
      if (recentReload()) return;
      hardReload();
    };
    window.addEventListener("vite:preloadError", onPreload);
    return () => window.removeEventListener("vite:preloadError", onPreload);
  }, []);
  return null;
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const stale = isStaleChunkError(error);

  useEffect(() => {
    if (!stale || typeof window === "undefined") return;
    if (recentReload()) return;
    hardReload();
  }, [stale]);

  return (
    <main
      className={
        "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center " +
        "bg-background text-foreground"
      }
    >
      <span className="text-destructive" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-muted-foreground">
        {stale
          ? "The site was updated. Reload to get the latest version."
          : errorMessage(error)}
      </p>
      <button
        type="button"
        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        onClick={() => {
          if (typeof window !== "undefined") window.location.reload();
        }}
      >
        Reload
      </button>
    </main>
  );
}
