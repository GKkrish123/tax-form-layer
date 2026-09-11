export {
  resolveBinding,
  resolveBindingDetailed,
  queryJsonPath,
  type ResolvedValue,
  type ResolveContext,
  type ResolveResult,
} from './resolve/binding.js';
export { evaluateCondition } from './resolve/condition.js';
export { isUnboundPath } from './resolve/query.js';
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
export { helveticaWidth, helveticaMeasurer } from './layout/metrics.js';
export { planTemplate, compileTemplate, type CompileResult } from './plan/plan.js';
export {
  collectPaths,
  coverage,
  toDataJsonSchema,
  type CoverageReport,
} from './plan/coverage.js';
export type {
  RenderPlan,
  RenderPage,
  DrawOp,
  TextDrawOp,
  MarkDrawOp,
  DrawTrace,
} from './plan/types.js';
