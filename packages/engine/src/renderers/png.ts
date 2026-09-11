import { crc32, deflateSync } from 'node:zlib';
import type { DrawOp, MarkDrawOp, RenderPlan, TextDrawOp } from '../plan/types.js';
import { layoutText, type TextMeasurer } from '../layout/text.js';
import { helveticaWidth } from '../layout/metrics.js';

export interface RenderPngOptions {
  /** 1-based page index into the plan. Defaults to 1. */
  page?: number;
  /** Pixels per point. Default 2 (144 dpi-ish). */
  scale?: number;
}

const measurer: TextMeasurer = { widthOf: helveticaWidth };

export function renderPng(plan: RenderPlan, options: RenderPngOptions = {}): Uint8Array {
  const scale = options.scale ?? 2;
  const pageIndex = (options.page ?? 1) - 1;
  const page = plan.pages[pageIndex] ?? plan.pages[0];
  if (!page) {
    return encodePng(1, 1, new Uint8Array([255, 255, 255, 255]));
  }

  const width = Math.max(1, Math.round(page.size.width * scale));
  const height = Math.max(1, Math.round(page.size.height * scale));
  const rgba = new Uint8Array(width * height * 4);
  rgba.fill(255);

  for (const op of page.ops) {
    if (op.kind === 'text') drawText(rgba, width, height, scale, op);
    else drawMark(rgba, width, height, scale, op);
  }

  return encodePng(width, height, rgba);
}

function idx(x: number, y: number, width: number): number {
  return (y * width + x) * 4;
}

function fillRect(
  rgba: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: [number, number, number],
) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(width, Math.ceil(x + w));
  const y1 = Math.min(height, Math.ceil(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const i = idx(px, py, width);
      rgba[i] = rgb[0];
      rgba[i + 1] = rgb[1];
      rgba[i + 2] = rgb[2];
      rgba[i + 3] = 255;
    }
  }
}

function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function drawText(
  rgba: Uint8Array,
  width: number,
  height: number,
  scale: number,
  op: TextDrawOp,
) {
  const layout = layoutText(op, measurer);
  const color = parseHex(op.style.color);
  const pxSize = Math.max(1, Math.round(layout.fontSize * scale * 0.7));
  for (const line of layout.lines) {
    const x = line.x * scale;
    const y = (line.baseline - layout.fontSize * 0.8) * scale;
    blitText(rgba, width, height, line.text, x, y, pxSize, color);
  }
}

function drawMark(
  rgba: Uint8Array,
  width: number,
  height: number,
  scale: number,
  op: MarkDrawOp,
) {
  const color = parseHex(op.color);
  const x = op.rect.x * scale;
  const y = op.rect.y * scale;
  const w = op.rect.width * scale;
  const h = op.rect.height * scale;
  if (op.mark === 'fill') {
    fillRect(rgba, width, height, x, y, w, h, color);
    return;
  }
  blitText(rgba, width, height, op.mark === 'text' ? op.markText : 'X', x, y, Math.max(1, h * 0.8), color);
}

/** Very small 5×7 glyphs for ASCII 32–90 — enough for filled-form proof. */
function blitText(
  rgba: Uint8Array,
  width: number,
  height: number,
  text: string,
  x: number,
  y: number,
  pixelSize: number,
  rgb: [number, number, number],
) {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const glyph = GLYPH[ch] ?? GLYPH['?'];
    for (let row = 0; row < 7; row++) {
      const bits = glyph?.[row] ?? 0;
      for (let col = 0; col < 5; col++) {
        if (bits & (1 << (4 - col))) {
          fillRect(
            rgba,
            width,
            height,
            cx + col * (pixelSize / 5),
            y + row * (pixelSize / 7),
            pixelSize / 5,
            pixelSize / 7,
            rgb,
          );
        }
      }
    }
    cx += pixelSize * 0.7;
  }
}

const GLYPH: Record<string, number[]> = {
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  '3': [0x0e, 0x11, 0x01, 0x06, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x13, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x01, 0x01, 0x01, 0x01, 0x11, 0x11, 0x0e],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0e, 0x11, 0x10, 0x0e, 0x01, 0x11, 0x0e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '-': [0, 0, 0, 0x1f, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0x04, 0x04],
  ',': [0, 0, 0, 0, 0x04, 0x04, 0x08],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '?': [0x0e, 0x11, 0x01, 0x06, 0x04, 0, 0x04],
};

function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    const src = y * width * 4;
    rgba.copyWithin;
    Buffer.from(rgba.buffer, rgba.byteOffset + src, width * 4).copy(raw, rowStart + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const chunks = [
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ];
  return Buffer.concat(chunks);
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
