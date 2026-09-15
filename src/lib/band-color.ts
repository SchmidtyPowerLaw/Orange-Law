const Z_COLOR_STOPS: Array<[number, string]> = [
  [-3.4, "#0d4f5c"],
  [-2, "#3ee8ff"],
  [-1, "#5dff7a"],
  [0, "#ffe14a"],
  [1, "#ff7a18"],
  [2, "#ff4d8a"],
  [2.8, "#c84bff"],
];

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function colorAtZ(z: number): string {
  const lo = Z_COLOR_STOPS[0][0];
  const hi = Z_COLOR_STOPS[Z_COLOR_STOPS.length - 1][0];
  const zz = Math.min(hi, Math.max(lo, z));
  let i = 0;
  while (i < Z_COLOR_STOPS.length - 2 && zz > Z_COLOR_STOPS[i + 1][0]) i += 1;
  const [z0, c0] = Z_COLOR_STOPS[i];
  const [z1, c1] = Z_COLOR_STOPS[i + 1];
  const t = z1 === z0 ? 0 : (zz - z0) / (z1 - z0);
  const a = hexToRgb(c0);
  const b = hexToRgb(c1);
  return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}

export function quantizeColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const q = (v: number) => Math.round(v / 14) * 14;
  return rgbToHex(q(r), q(g), q(b));
}
