import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

const SRC = "/videos/zoom-out-curve.mp4?v=2";
const POSTER = "/videos/zoom-out-curve.jpg?v=2";
const LABEL =
  "Bitcoin users spread like a wave cubed with time. Price grows with those users. Multiply those two laws, and you get the power law that’s held for fifteen years.";

export function CurveFilm() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [muted, setMuted] = useState(true);
  const mutedRef = useRef(true);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.setAttribute("webkit-playsinline", "true");
    v.setAttribute("playsinline", "true");
    v.muted = true;
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting && entry.intersectionRatio >= 0.35);
      },
      { threshold: [0, 0.2, 0.35, 0.6, 1], rootMargin: "80px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const tryPlay = useCallback(async (wantMuted: boolean) => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = wantMuted;
    try {
      await v.play();
    } catch {
      if (!v.muted) {
        v.muted = true;
        mutedRef.current = true;
        setMuted(true);
        await v.play().catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inView) {
      void tryPlay(mutedRef.current);
    } else {
      v.pause();
    }
  }, [inView, tryPlay]);

  useEffect(() => {
    const onHide = () => {
      if (document.hidden) videoRef.current?.pause();
      else if (inView) void tryPlay(mutedRef.current);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [inView, tryPlay]);

  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    const v = videoRef.current;
    if (v) {
      v.muted = next;
      v.volume = 1;
      if (v.paused) void tryPlay(next);
    }
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-xl bg-card p-5 shadow-[var(--shadow-border)] md:p-6">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        The network
      </p>
      <h2 className="mt-2 font-display text-2xl text-foreground">Zoom out. Trust the curve.</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
        Users cube with time. Price grows with those users. Same slope through every boom and crash
        — the curve doesn’t care.
      </p>

      <div className="relative mx-auto mt-6 w-full max-w-[min(100%,22rem)] md:max-w-[24rem]">
        <div
          className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] opacity-70 blur-2xl"
          style={{
            background:
              "radial-gradient(ellipse at 50% 70%, rgba(255,90,18,0.28), rgba(255,180,40,0.08) 42%, transparent 70%)",
          }}
        />
        <div
          ref={wrapRef}
          className="relative aspect-[9/16] overflow-hidden rounded-xl shadow-[var(--shadow-border)]"
        >
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            src={SRC}
            poster={POSTER}
            muted
            loop
            playsInline
            preload="metadata"
            disablePictureInPicture
            controls={false}
            aria-label={LABEL}
            onLoadedData={() => {
              const v = videoRef.current;
              if (v && inView) void tryPlay(mutedRef.current);
            }}
          />
          <button
            type="button"
            onClick={toggleMute}
            aria-pressed={!muted}
            aria-label={muted ? "Turn sound on" : "Mute"}
            className={cn(
              "absolute bottom-3 right-3 z-10 inline-flex size-11 items-center justify-center rounded-full",
              "bg-ink/70 text-sand backdrop-blur-sm shadow-[var(--shadow-border)]",
              "transition-[background-color,color,box-shadow,transform] duration-150",
              "hover:shadow-[var(--shadow-border-hover)] active:scale-[0.96]",
              !muted && "bg-primary text-primary-foreground",
            )}
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
          {muted ? (
            <p className="pointer-events-none absolute bottom-4 left-3 right-16 text-[11px] font-medium tracking-wide text-sand/80">
              Sound off
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
