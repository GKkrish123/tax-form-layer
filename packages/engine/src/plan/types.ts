import type { Binding, PageSize, Style, Transform } from '@tax-form-layer/spec';
import type { PointRect } from '../geometry/coordinates.js';

export interface DrawTrace {
  fieldId: string;
  copyId?: string;
  raw: unknown;
  formatted: string;
  binding?: Binding;
  transforms?: Transform[];
}

export interface TextDrawOp {
  kind: 'text';
  fieldId: string;
  rect: PointRect;
  text: string;
  style: Style;
  trace?: DrawTrace;
}

export interface MarkDrawOp {
  kind: 'mark';
  fieldId: string;
  rect: PointRect;
  mark: 'check' | 'cross' | 'fill' | 'text';
  markText: string;
  color: string;
  trace?: DrawTrace;
}

export type DrawOp = TextDrawOp | MarkDrawOp;

export interface RenderPage {
  number: number;
  copyId?: string;
  copyTitle?: string;
  size: PageSize;
  backgroundRef: number | string;
  ops: DrawOp[];
}

/** Renderer-agnostic draw plan — the seam between resolution/layout and PDF/image backends. */
export interface RenderPlan {
  templateId: string;
  medium: 'pdf' | 'image';
  dpi: number;
  pages: RenderPage[];
}
