import type { PageSize, Style } from '@tax-form-layer/spec';
import type { PointRect } from '../geometry/coordinates.js';

export interface TextDrawOp {
  kind: 'text';
  fieldId: string;
  rect: PointRect;
  text: string;
  style: Style;
}

export interface MarkDrawOp {
  kind: 'mark';
  fieldId: string;
  rect: PointRect;
  mark: 'check' | 'cross' | 'fill' | 'text';
  markText: string;
  color: string;
}

export type DrawOp = TextDrawOp | MarkDrawOp;

export interface RenderPage {
  number: number;
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
