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

const HTML_STYLE_PROPS = [
  "color",
  "background-color",
  "background-image",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant",
  "letter-spacing",
  "line-height",
  "text-align",
  "text-transform",
  "text-shadow",
  "opacity",
  "display",
  "padding",
  "border",
  "border-radius",
  "box-sizing",
  "white-space",
  "overflow",
  "width",
  "height",
] as const;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
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
      if (cs.fill && cs.fill !== "none") dst.setAttribute("fill", cs.fill);
    }
    if (strokeAttr === "none") dst.setAttribute("stroke", "none");
    else if (strokeAttr || tag === "line" || tag === "path") {
      if (cs.stroke && cs.stroke !== "none") dst.setAttribute("stroke", cs.stroke);
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
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(pixelW));
  clone.setAttribute("height", String(pixelH));
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function copyComputed(src: HTMLElement, dst: HTMLElement) {
  const cs = getComputedStyle(src);
  for (const prop of HTML_STYLE_PROPS) {
    dst.style.setProperty(prop, cs.getPropertyValue(prop));
  }
  const from = src.querySelectorAll<HTMLElement>("*");
  const to = dst.querySelectorAll<HTMLElement>("*");
  const n = Math.min(from.length, to.length);
  for (let i = 0; i < n; i++) {
    const fcs = getComputedStyle(from[i]);
    for (const prop of HTML_STYLE_PROPS) {
      to[i].style.setProperty(prop, fcs.getPropertyValue(prop));
    }
  }
}

async function htmlToImage(el: HTMLElement, pixelRatio: number): Promise<HTMLImageElement | null> {
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  const clone = el.cloneNode(true) as HTMLElement;
  copyComputed(el, clone);
  clone.style.position = "static";
  clone.style.left = "0";
  clone.style.top = "0";
  clone.style.margin = "0";
  clone.style.transform = "none";
  const w = Math.max(1, Math.ceil(r.width));
  const h = Math.max(1, Math.ceil(r.height));
  const pw = Math.round(w * pixelRatio);
  const ph = Math.round(h * pixelRatio);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="0 0 ${w} ${h}">` +
    `<foreignObject width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px">${clone.outerHTML}</div>` +
    `</foreignObject></svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadChartJpeg(node: HTMLElement, filename: string): Promise<void> {
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
    const dx = (cr.left - origin.left) * scale;
    const dy = (cr.top - origin.top) * scale;
    const dw = cr.width * scale;
    const dh = cr.height * scale;
    if (dw < 1 || dh < 1) continue;
    const opacity = Number(getComputedStyle(child).opacity);
    if (!(opacity > 0.02)) continue;
    ctx.save();
    ctx.globalAlpha = Number.isFinite(opacity) ? opacity : 1;
    if (child instanceof HTMLImageElement && child.naturalWidth > 0) {
      ctx.drawImage(child, dx, dy, dw, dh);
    } else {
      const overlay = await htmlToImage(child, scale);
      if (overlay) ctx.drawImage(overlay, dx, dy, dw, dh);
    }
    ctx.restore();
  }

  const url = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function chartExportFilename(currency: string, range: string): string {
  const day = new Date().toISOString().slice(0, 10);
  const unit = currency === "XAU" ? "gold" : currency.toLowerCase();
  return `orange-law-${unit}-${range}-${day}.jpg`;
}
