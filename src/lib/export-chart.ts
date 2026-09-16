import { bytesToBlob, writeSave } from "@/lib/save-file";

const MAX_EDGE = 4096;
const JPEG_QUALITY = 0.95;
const SCALE_TARGET = 4;

const SVG_PAINT_TAGS = new Set([
  "svg",
  "path",
  "line",
  "circle",
  "rect",
  "ellipse",
  "polygon",
  "polyline",
  "g",
  "text",
  "tspan",
]);

function toRgb(color: string): string {
  if (!color || color === "none" || color === "transparent") return color;
  if (color.startsWith("#") || color.startsWith("rgb")) return color;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return color;
  ctx.fillStyle = "#000";
  ctx.fillStyle = color;
  return String(ctx.fillStyle);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = window.setTimeout(() => reject(new Error("image load timeout")), 12000);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

function inlineSvgPaints(source: SVGElement, clone: SVGElement) {
  const from = [source, ...source.querySelectorAll<SVGElement>("*")];
  const to = [clone, ...clone.querySelectorAll<SVGElement>("*")];
  const n = Math.min(from.length, to.length);
  for (let i = 0; i < n; i++) {
    const src = from[i];
    const dst = to[i];
    const tag = dst.tagName.toLowerCase();
    if (!SVG_PAINT_TAGS.has(tag)) continue;
    const cs = getComputedStyle(src);
    const fillAttr = src.getAttribute("fill");
    const strokeAttr = src.getAttribute("stroke");
    const cls = src.getAttribute("class") ?? "";
    if (fillAttr === "none") dst.setAttribute("fill", "none");
    else if (fillAttr || /band-/.test(cls) || tag === "text" || tag === "tspan") {
      if (cs.fill && cs.fill !== "none") dst.setAttribute("fill", toRgb(cs.fill));
    }
    if (strokeAttr === "none") dst.setAttribute("stroke", "none");
    else if (strokeAttr || tag === "line" || tag === "path") {
      if (cs.stroke && cs.stroke !== "none") dst.setAttribute("stroke", toRgb(cs.stroke));
    }
    if (strokeAttr || tag === "line" || tag === "path") {
      if (cs.strokeWidth) dst.setAttribute("stroke-width", String(parseFloat(cs.strokeWidth) || 1));
    }
    if (cs.strokeDasharray && cs.strokeDasharray !== "none") {
      dst.setAttribute("stroke-dasharray", cs.strokeDasharray);
    }
    const op = src.getAttribute("opacity") ?? cs.opacity;
    if (op && op !== "1") dst.setAttribute("opacity", String(op));
    if (tag === "text" || tag === "tspan") {
      dst.setAttribute("font-family", cs.fontFamily);
      dst.setAttribute("font-size", cs.fontSize);
      dst.setAttribute("font-weight", cs.fontWeight);
      if (cs.letterSpacing && cs.letterSpacing !== "normal") {
        dst.setAttribute("letter-spacing", cs.letterSpacing);
      }
    }
  }
}

async function svgToImage(svg: SVGSVGElement, pixelW: number, pixelH: number): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineSvgPaints(svg, clone);
  clone.querySelectorAll("filter").forEach((node) => node.remove());
  clone.querySelectorAll("[filter]").forEach((node) => node.removeAttribute("filter"));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(pixelW));
  clone.setAttribute("height", String(pixelH));
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } catch {
    const data = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
    return await loadImage(data);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function isTransparent(color: string): boolean {
  const c = color.replace(/\s+/g, "");
  return (
    !c ||
    c === "none" ||
    c === "transparent" ||
    /^rgba?\(0,0,0,0\)/.test(c) ||
    /\/0\)/.test(c)
  );
}

function applyTextShadow(ctx: CanvasRenderingContext2D, shadow: string, scale: number) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  if (!shadow || shadow === "none") return;
  const m = shadow.match(
    /(rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\)|color\([^)]+\)|#[0-9a-fA-F]{3,8})\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px/i,
  );
  if (!m) return;
  ctx.shadowColor = toRgb(m[1]);
  ctx.shadowOffsetX = parseFloat(m[2]) * scale;
  ctx.shadowOffsetY = parseFloat(m[3]) * scale;
  ctx.shadowBlur = parseFloat(m[4]) * scale;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (maxWidth < 8 || ctx.measureText(text).width <= maxWidth) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) cur = test;
    else {
      if (cur) lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}

function paintTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  el: HTMLElement,
  origin: DOMRect,
  scale: number,
) {
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const fontSize = parseFloat(cs.fontSize) || 10;
  const font = `${cs.fontStyle} ${cs.fontWeight} ${fontSize * scale}px ${cs.fontFamily}`;
  ctx.font = font;
  ctx.fillStyle = toRgb(cs.color);
  const align = cs.textAlign === "center" || cs.textAlign === "right" ? cs.textAlign : "left";
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  applyTextShadow(ctx, cs.textShadow, scale);
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padR = parseFloat(cs.paddingRight) || 0;
  const padT = parseFloat(cs.paddingTop) || 0;
  const maxW = Math.max(8, (r.width - padL - padR) * scale);
  const lines = wrapLines(ctx, text, maxW);
  const lhRaw = cs.lineHeight;
  const lh = (lhRaw === "normal" || !lhRaw ? fontSize * 1.15 : parseFloat(lhRaw)) * scale;
  let x = (r.left - origin.left + padL) * scale;
  if (align === "center") x = (r.left - origin.left + r.width / 2) * scale;
  if (align === "right") x = (r.right - origin.left - padR) * scale;
  let y = (r.top - origin.top + padT) * scale;
  for (const line of lines) {
    ctx.fillText(line, x, y, maxW);
    y += lh;
  }
}

function paintOverlay(
  ctx: CanvasRenderingContext2D,
  el: HTMLElement,
  origin: DOMRect,
  scale: number,
) {
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") return;
  const opacity = Number(cs.opacity);
  if (!(opacity > 0.02)) return;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return;

  ctx.save();
  ctx.globalAlpha *= Number.isFinite(opacity) ? opacity : 1;

  const bg = toRgb(cs.backgroundColor);
  if (bg && !isTransparent(bg)) {
    const x = (r.left - origin.left) * scale;
    const y = (r.top - origin.top) * scale;
    const w = r.width * scale;
    const h = r.height * scale;
    const rad = Math.min(h / 2, (parseFloat(cs.borderRadius) || 0) * scale);
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, rad);
    else ctx.rect(x, y, w, h);
    ctx.fillStyle = bg;
    ctx.fill();
  }

  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.textContent?.replace(/\s+/g, " ").trim();
      if (raw) paintTextBlock(ctx, raw, el, origin, scale);
    } else if (node instanceof HTMLImageElement && node.naturalWidth > 0) {
      const ir = node.getBoundingClientRect();
      ctx.drawImage(
        node,
        (ir.left - origin.left) * scale,
        (ir.top - origin.top) * scale,
        ir.width * scale,
        ir.height * scale,
      );
    } else if (node instanceof HTMLElement) {
      paintOverlay(ctx, node, origin, scale);
    }
  }
  ctx.restore();
}

export async function renderChartJpeg(node: HTMLElement): Promise<{
  bytes: Uint8Array;
  width: number;
  height: number;
  displayW: number;
  displayH: number;
}> {
  const svg = node.querySelector("svg");
  if (!(svg instanceof SVGSVGElement)) throw new Error("chart svg missing");
  const w = node.clientWidth;
  const h = node.clientHeight;
  if (w < 8 || h < 8) throw new Error("chart not ready");
  const scale = Math.max(2, Math.min(SCALE_TARGET, MAX_EDGE / Math.max(w, h)));
  const pw = Math.round(w * scale);
  const ph = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const bg = getComputedStyle(node).backgroundColor || "#0c0c0c";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, pw, ph);

  const svgImg = await svgToImage(svg, pw, ph);
  ctx.drawImage(svgImg, 0, 0, pw, ph);

  const origin = node.getBoundingClientRect();
  for (const child of Array.from(node.children)) {
    if (child === svg || !(child instanceof HTMLElement)) continue;
    const cr = child.getBoundingClientRect();
    if (cr.width < 1 || cr.height < 1) continue;
    const opacity = Number(getComputedStyle(child).opacity);
    if (!(opacity > 0.02)) continue;
    if (child instanceof HTMLImageElement && child.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = Number.isFinite(opacity) ? opacity : 1;
      ctx.drawImage(
        child,
        (cr.left - origin.left) * scale,
        (cr.top - origin.top) * scale,
        cr.width * scale,
        cr.height * scale,
      );
      ctx.restore();
      continue;
    }
    paintOverlay(ctx, child, origin, scale);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((next) => (next ? resolve(next) : reject(new Error("jpeg"))), "image/jpeg", JPEG_QUALITY);
  });
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width: pw,
    height: ph,
    displayW: w,
    displayH: h,
  };
}

export async function downloadChartJpeg(node: HTMLElement, filename: string): Promise<void> {
  const jpeg = await renderChartJpeg(node);
  await writeSave(null, bytesToBlob(jpeg.bytes, "image/jpeg"), filename);
}

export function chartExportFilename(currency: string, range: string): string {
  const day = new Date().toISOString().slice(0, 10);
  const unit = currency === "XAU" ? "gold" : currency.toLowerCase();
  return `orange-law-${unit}-${range}-${day}.jpg`;
}
