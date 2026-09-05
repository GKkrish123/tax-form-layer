import { describe, it, expect } from 'vitest';
import { rectToPoints, toPdfRect, toPixelRect } from '../src/geometry/coordinates.js';

const letter = { width: 612, height: 792 };

describe('coordinates', () => {
  it('converts fractional coordinates to points against page size', () => {
    const p = rectToPoints(
      { x: 0.5, y: 0.25, width: 0.1, height: 0.05, rotation: 0, unit: 'fraction' },
      letter,
      150,
    );
    expect(p.x).toBeCloseTo(306);
    expect(p.y).toBeCloseTo(198);
    expect(p.width).toBeCloseTo(61.2);
    expect(p.height).toBeCloseTo(39.6);
  });

  it('passes points through unchanged', () => {
    const p = rectToPoints(
      { x: 100, y: 200, width: 50, height: 10, rotation: 0, unit: 'pt' },
      letter,
      150,
    );
    expect(p).toMatchObject({ x: 100, y: 200, width: 50, height: 10 });
  });

  it('scales pixels through DPI', () => {
    const p = rectToPoints(
      { x: 150, y: 0, width: 300, height: 0.0001, rotation: 0, unit: 'px' },
      letter,
      150,
    );
    expect(p.x).toBeCloseTo(72);
    expect(p.width).toBeCloseTo(144);
  });

  it('flips a top-left rect into PDF bottom-left space', () => {
    const pdf = toPdfRect({ x: 10, y: 20, width: 100, height: 30, rotation: 0 }, 792);
    expect(pdf.yBottom).toBeCloseTo(792 - (20 + 30));
  });

  it('scales points to pixels for image medium', () => {
    const px = toPixelRect({ x: 72, y: 0, width: 36, height: 10, rotation: 0 }, 300);
    expect(px.x).toBeCloseTo(300);
    expect(px.width).toBeCloseTo(150);
  });
});
