let canvasEl: HTMLCanvasElement | null = null;

export function registerCanvas(el: HTMLCanvasElement | null): void {
  canvasEl = el;
}

export interface CaptureOptions {
  maxDim?: number;
  quality?: number;
  /** Free-tier vision providers reject large inline images. */
  maxBytes?: number;
}

function encodeAt(source: HTMLCanvasElement, dim: number, quality: number): string {
  const scale = Math.min(1, dim / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d');
  if (!ctx) return source.toDataURL('image/jpeg', quality);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return off.toDataURL('image/jpeg', quality);
}

export function captureCanvasDataUrl(opts: CaptureOptions = {}): string | null {
  if (!canvasEl) return null;
  const { maxDim = 1400, quality = 0.82, maxBytes = 175_000 } = opts;
  try {
    let dim = maxDim;
    let q = quality;
    let out = encodeAt(canvasEl, dim, q);
    // Shrink quality first, then dimensions, until the payload fits the budget.
    let guard = 0;
    while (out.length > maxBytes && guard++ < 12) {
      if (q > 0.5) q -= 0.1;
      else dim = Math.round(dim * 0.82);
      if (dim < 640) break;
      out = encodeAt(canvasEl, dim, q);
    }
    return out;
  } catch {
    return null;
  }
}
