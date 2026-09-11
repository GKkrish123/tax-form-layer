import type { Rect } from '@tax-form-layer/spec';

export interface Guide {
  x?: number;
  y?: number;
}

const THRESHOLD = 0.008;

export function snapMove(
  next: { x: number; y: number; width: number; height: number },
  others: Rect[],
): { rect: typeof next; guides: Guide[] } {
  const guides: Guide[] = [];
  let { x, y } = next;
  const cx = x + next.width / 2;
  const cy = y + next.height / 2;
  const right = x + next.width;
  const bottom = y + next.height;

  const xs = [0, 0.5, 1];
  const ys = [0, 0.5, 1];
  for (const o of others) {
    xs.push(o.x, o.x + o.width / 2, o.x + o.width);
    ys.push(o.y, o.y + o.height / 2, o.y + o.height);
  }

  for (const t of xs) {
    if (Math.abs(x - t) < THRESHOLD) {
      x = t;
      guides.push({ x: t });
    } else if (Math.abs(cx - t) < THRESHOLD) {
      x = t - next.width / 2;
      guides.push({ x: t });
    } else if (Math.abs(right - t) < THRESHOLD) {
      x = t - next.width;
      guides.push({ x: t });
    }
  }
  for (const t of ys) {
    if (Math.abs(y - t) < THRESHOLD) {
      y = t;
      guides.push({ y: t });
    } else if (Math.abs(cy - t) < THRESHOLD) {
      y = t - next.height / 2;
      guides.push({ y: t });
    } else if (Math.abs(bottom - t) < THRESHOLD) {
      y = t - next.height;
      guides.push({ y: t });
    }
  }

  return { rect: { ...next, x: clamp01(x), y: clamp01(y) }, guides };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function alignRects(
  ids: string[],
  fields: Array<{ id: string; rect: Rect }>,
  mode:
    | 'left'
    | 'center'
    | 'right'
    | 'top'
    | 'middle'
    | 'bottom'
    | 'distributeX'
    | 'distributeY',
): Array<{ id: string; rect: Partial<Rect> }> {
  const selected = fields.filter((f) => ids.includes(f.id));
  if (selected.length < 2) return [];
  const minX = Math.min(...selected.map((f) => f.rect.x));
  const maxR = Math.max(...selected.map((f) => f.rect.x + f.rect.width));
  const minY = Math.min(...selected.map((f) => f.rect.y));
  const maxB = Math.max(...selected.map((f) => f.rect.y + f.rect.height));
  const midX = (minX + maxR) / 2;
  const midY = (minY + maxB) / 2;

  if (mode === 'distributeX' || mode === 'distributeY') {
    const sorted = [...selected].sort((a, b) =>
      mode === 'distributeX' ? a.rect.x - b.rect.x : a.rect.y - b.rect.y,
    );
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const span =
      mode === 'distributeX'
        ? last.rect.x - first.rect.x
        : last.rect.y - first.rect.y;
    const step = span / (sorted.length - 1);
    return sorted.map((f, i) => ({
      id: f.id,
      rect:
        mode === 'distributeX'
          ? { x: first.rect.x + step * i }
          : { y: first.rect.y + step * i },
    }));
  }

  return selected.map((f) => {
    switch (mode) {
      case 'left':
        return { id: f.id, rect: { x: minX } };
      case 'right':
        return { id: f.id, rect: { x: maxR - f.rect.width } };
      case 'center':
        return { id: f.id, rect: { x: midX - f.rect.width / 2 } };
      case 'top':
        return { id: f.id, rect: { y: minY } };
      case 'bottom':
        return { id: f.id, rect: { y: maxB - f.rect.height } };
      case 'middle':
        return { id: f.id, rect: { y: midY - f.rect.height / 2 } };
    }
  });
}
