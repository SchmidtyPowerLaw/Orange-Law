/** Cinematic timeline for the Bitcoin History button. */

export const HISTORY_FADE_MS = 2000;
export const HISTORY_BAND_MS = 340;
export const HISTORY_BAND_COUNT = 5;
export const HISTORY_PATH_MS = 60_000;
export const HISTORY_PATH_GAP_MS = 280;
export const HISTORY_PATH_START_MS =
  HISTORY_FADE_MS + HISTORY_BAND_COUNT * HISTORY_BAND_MS + HISTORY_PATH_GAP_MS;
export const HISTORY_HERO_MS = 2000;
export const HISTORY_HERO_MS_MOBILE = 3000;
export const HISTORY_STILL_SHRINK_MS = 720;
export const HISTORY_STILL_FADE_MS = 2000;

export function stillHeroMs(compact: boolean): number {
  return compact ? HISTORY_HERO_MS_MOBILE : HISTORY_HERO_MS;
}

export type ReelState = {
  fade: number;
  bandOn: boolean[];
  pathU: number;
  revealT: number;
  drawing: boolean;
  done: boolean;
};

export function reelState(elapsed: number, tMin: number, tMax: number): ReelState {
  const fade = elapsed < HISTORY_FADE_MS ? 1 - elapsed / HISTORY_FADE_MS : 0;
  const bandOn = Array.from({ length: HISTORY_BAND_COUNT }, (_, i) => {
    return elapsed >= HISTORY_FADE_MS + i * HISTORY_BAND_MS;
  });
  const pathU =
    elapsed < HISTORY_PATH_START_MS
      ? 0
      : Math.min(1, (elapsed - HISTORY_PATH_START_MS) / HISTORY_PATH_MS);
  const lo = Math.log10(Math.max(1, tMin));
  const hi = Math.log10(Math.max(tMin + 1, tMax));
  const revealT = 10 ** (lo + pathU * (hi - lo));
  return {
    fade,
    bandOn,
    pathU,
    revealT,
    drawing: pathU > 0,
    done: pathU >= 1,
  };
}

/** Elapsed-ms on the reel clock when the path first reaches day `t`. */
export function pathAppearMs(t: number, tMin: number, tMax: number): number {
  const lo = Math.log10(Math.max(1, tMin));
  const hi = Math.log10(Math.max(tMin + 1, tMax));
  const span = Math.max(1e-9, hi - lo);
  const u = Math.min(1, Math.max(0, (Math.log10(Math.max(1, t)) - lo) / span));
  return HISTORY_PATH_START_MS + u * HISTORY_PATH_MS;
}