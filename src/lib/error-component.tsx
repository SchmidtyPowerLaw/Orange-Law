import { useEffect } from "react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
const RELOAD_KEY = "ol-chunk-reload";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

function isStaleChunkError(error: unknown): boolean {
  const msg = errorMessage(error);
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk \S+ failed/i.test(
    msg,
  );
}

export function ChunkLoadRecovery() {
  useEffect(() => {
    const onPreload = (event: Event) => {
      event.preventDefault();
      if (sessionStorage.getItem(RELOAD_KEY) === "1") return;
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
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
    if (sessionStorage.getItem(RELOAD_KEY) === "1") return;
    sessionStorage.setItem(RELOAD_KEY, "1");
    window.location.reload();
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
