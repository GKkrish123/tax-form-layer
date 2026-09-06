import type { TextDrawOp } from '../plan/types.js';
import type { Padding } from '@tax-form-layer/spec';

/** Font metrics come from the drawing backend (pdf-lib, canvas), not this module. */
export interface TextMeasurer {
  widthOf(text: string, fontSize: number): number;
}

export interface PositionedLine {
  text: string;
  x: number;
  baseline: number;
}

export interface LayoutResult {
  fontSize: number;
  lines: PositionedLine[];
}

export function effectivePadding(
  rect: { width: number; height: number },
  padding: Padding | undefined,
): Padding {
  if (padding) return padding;
  const h = Math.max(0, rect.height);
  const w = Math.max(0, rect.width);
  return {
    top: clamp(h * 0.14, 0.6, 2.5),
    bottom: clamp(h * 0.14, 0.6, 2.5),
    left: clamp(w * 0.035, 0.8, 3.5),
    right: clamp(w * 0.035, 0.8, 3.5),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function wrapLines(text: string, maxWidth: number, fontSize: number, m: TextMeasurer): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      const candidate = current === '' ? word : `${current} ${word}`;
      if (m.widthOf(candidate, fontSize) <= maxWidth || current === '') {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function ellipsize(text: string, maxWidth: number, fontSize: number, m: TextMeasurer): string {
  if (m.widthOf(text, fontSize) <= maxWidth) return text;
  const ell = '…';
  let out = text;
  while (out.length > 0 && m.widthOf(out + ell, fontSize) > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + ell;
}

function alignX(lineWidth: number, innerLeft: number, innerWidth: number, align: string): number {
  switch (align) {
    case 'right':
      return innerLeft + innerWidth - lineWidth;
    case 'center':
      return innerLeft + (innerWidth - lineWidth) / 2;
    case 'left':
    default:
      return innerLeft;
  }
}

export function layoutText(op: TextDrawOp, m: TextMeasurer): LayoutResult {
  const { rect, style } = op;
  const pad = effectivePadding(rect, style.padding);
  const innerLeft = rect.x + pad.left;
  const innerTop = rect.y + pad.top;
  const innerWidth = Math.max(0, rect.width - pad.left - pad.right);
  const innerHeight = Math.max(0, rect.height - pad.top - pad.bottom);

  let fontSize = style.fontSize;
  let rawLines: string[];

  if (style.overflow === 'wrap') {
    rawLines = wrapLines(op.text, innerWidth, fontSize, m);
  } else if (style.overflow === 'shrink') {
    while (fontSize > style.minFontSize && m.widthOf(op.text, fontSize) > innerWidth) {
      fontSize -= 0.5;
    }
    rawLines = [op.text];
  } else if (style.overflow === 'ellipsis') {
    rawLines = [ellipsize(op.text, innerWidth, fontSize, m)];
  } else {
    rawLines = [op.text];
  }

  const lineHeight = fontSize * style.lineHeight;
  const blockHeight = rawLines.length * lineHeight;

  let blockTop: number;
  switch (style.verticalAlign) {
    case 'top':
      blockTop = innerTop;
      break;
    case 'bottom':
      blockTop = innerTop + innerHeight - blockHeight;
      break;
    case 'middle':
    default:
      blockTop = innerTop + (innerHeight - blockHeight) / 2;
      break;
  }

  const ascent = fontSize * 0.8;
  const lines: PositionedLine[] = rawLines.map((text, i) => {
    const width = m.widthOf(text, fontSize);
    return {
      text,
      x: alignX(width, innerLeft, innerWidth, style.align),
      baseline: blockTop + i * lineHeight + ascent,
    };
  });

  return { fontSize, lines };
}
