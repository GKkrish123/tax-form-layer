import type { Rect, PageSize, CoordinateUnit } from '@tax-form-layer/spec';

export interface PointRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

function convertScalar(
  value: number,
  unit: CoordinateUnit,
  pageExtentPt: number,
  dpi: number,
): number {
  switch (unit) {
    case 'pt':
      return value;
    case 'px':
      return (value * 72) / dpi;
    case 'fraction':
    default:
      // Default to fractions when unit is missing so un-normalized templates still yield finite coords.
      return value * pageExtentPt;
  }
}

export function rectToPoints(rect: Rect, page: PageSize, dpi: number): PointRect {
  return {
    x: convertScalar(rect.x, rect.unit, page.width, dpi),
    y: convertScalar(rect.y, rect.unit, page.height, dpi),
    width: convertScalar(rect.width, rect.unit, page.width, dpi),
    height: convertScalar(rect.height, rect.unit, page.height, dpi),
    rotation: rect.rotation,
  };
}

export interface PdfRect {
  x: number;
  yBottom: number;
  width: number;
  height: number;
  rotation: number;
}

export function toPdfRect(rect: PointRect, pageHeightPt: number): PdfRect {
  return {
    x: rect.x,
    yBottom: pageHeightPt - (rect.y + rect.height),
    width: rect.width,
    height: rect.height,
    rotation: rect.rotation,
  };
}

export function toPixelRect(rect: PointRect, dpi: number): PointRect {
  const factor = dpi / 72;
  return {
    x: rect.x * factor,
    y: rect.y * factor,
    width: rect.width * factor,
    height: rect.height * factor,
    rotation: rect.rotation,
  };
}
