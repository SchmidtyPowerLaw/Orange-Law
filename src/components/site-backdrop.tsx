import { useEffect, useRef } from "react";

export function SiteBackdrop() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("webkit-playsinline", "true");
    v.setAttribute("playsinline", "true");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      v.pause();
      return;
    }

    const play = () => {
      v.muted = true;
      void v.play().catch(() => {});
    };
    play();

    const onVis = () => {
      if (document.hidden) v.pause();
      else play();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <div className="site-bg" aria-hidden="true">
      <video
        ref={ref}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/bitcoin-city.jpg"
        src="/videos/city-loop.mp4"
        disablePictureInPicture
      />
    </div>
  );
}
