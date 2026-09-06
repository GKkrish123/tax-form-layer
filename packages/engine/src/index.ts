export {
  resolveBinding,
  queryJsonPath,
  type ResolvedValue,
  type ResolveContext,
} from './resolve/binding.js';
export { evaluateCondition } from './resolve/condition.js';
export { formatValue } from './format/index.js';
export {
  rectToPoints,
  toPdfRect,
  toPixelRect,
  type PointRect,
  type PdfRect,
} from './geometry/coordinates.js';
export {
  layoutText,
  effectivePadding,
  type TextMeasurer,
  type LayoutResult,
  type PositionedLine,
} from './layout/text.js';
export { planTemplate } from './plan/plan.js';
export type { RenderPlan, RenderPage, DrawOp, TextDrawOp, MarkDrawOp } from './plan/types.js';
