import type {
  FormTemplate,
  Field,
  ValueField,
  CheckboxField,
  CombField,
  RadioField,
  RepeatingGroup,
  Style,
  PageSize,
  Issue,
  Binding,
  FormCopy,
} from '@tax-form-layer/spec';
import { ISSUE_CODES, Style as StyleSchema } from '@tax-form-layer/spec';
import {
  resolveBindingDetailed,
  type ResolveContext,
  type ResolvedValue,
} from '../resolve/binding.js';
import { evaluateCondition } from '../resolve/condition.js';
import { isUnboundPath, queryJsonPath } from '../resolve/query.js';
import { formatValue } from '../format/index.js';
import { rectToPoints, type PointRect } from '../geometry/coordinates.js';
import { layoutText, effectivePadding } from '../layout/text.js';
import { helveticaMeasurer } from '../layout/metrics.js';
import { coverage, type CoverageReport } from './coverage.js';
import type { DrawOp, DrawTrace, RenderPage, RenderPlan, TextDrawOp } from './types.js';

const DEFAULT_STYLE: Style = StyleSchema.parse({});

function resolveStyle(style: Partial<Style> | undefined): Style {
  return style ? { ...DEFAULT_STYLE, ...style } : DEFAULT_STYLE;
}

interface Offset {
  dx: number;
  dy: number;
}

const ZERO: Offset = { dx: 0, dy: 0 };

export interface CompileResult {
  plan: RenderPlan;
  issues: Issue[];
  coverage: CoverageReport;
}

interface CompileCtx {
  issues: Issue[];
  copyId?: string;
  pageFields: Field[];
}

function qualify(fieldId: string, copyId?: string): string {
  return copyId ? `${copyId}:${fieldId}` : fieldId;
}

function placeRect(
  rect: ValueField['rect'],
  page: PageSize,
  dpi: number,
  offset: Offset,
): PointRect {
  const p = rectToPoints(rect, page, dpi);
  return { ...p, x: p.x + offset.dx, y: p.y + offset.dy };
}

function isChecked(field: CheckboxField, value: ResolvedValue): boolean {
  if (field.checkedWhen !== undefined) return value === field.checkedWhen;
  return Boolean(value);
}

function emptyValue(value: ResolvedValue): boolean {
  return value === undefined || value === null || value === '';
}

function bindingPath(binding: Binding | undefined): string | undefined {
  if (!binding) return undefined;
  if (binding.source === 'jsonpath') return binding.path;
  if (binding.source === 'pointer') return binding.pointer;
  return undefined;
}

function pushIssue(ctx: CompileCtx, issue: Issue) {
  ctx.issues.push({
    ...issue,
    fieldId: issue.fieldId,
  });
}

function checkUnbound(ctx: CompileCtx, fieldId: string, binding: Binding | undefined) {
  if (binding?.source === 'jsonpath' && isUnboundPath(binding.path)) {
    pushIssue(ctx, {
      code: ISSUE_CODES.UNBOUND,
      severity: 'warning',
      fieldId,
      path: binding.path,
      message: `Field "${fieldId}" is unbound`,
    });
  }
}

function checkMissing(
  ctx: CompileCtx,
  fieldId: string,
  binding: Binding | undefined,
  raw: ResolvedValue,
) {
  if (emptyValue(raw) && binding?.fallback === undefined) {
    pushIssue(ctx, {
      code: ISSUE_CODES.MISSING,
      severity: 'warning',
      fieldId,
      path: bindingPath(binding),
      message: `Field "${fieldId}" resolved empty`,
    });
  }
}

function checkConstraints(
  ctx: CompileCtx,
  field: { id: string; required?: boolean; pattern?: string; maxChars?: number },
  raw: ResolvedValue,
  formatted: string,
) {
  const fieldId = qualify(field.id, ctx.copyId);
  if (field.required && emptyValue(raw)) {
    pushIssue(ctx, {
      code: ISSUE_CODES.CONSTRAINT,
      severity: 'error',
      fieldId,
      message: `Field "${field.id}" is required`,
    });
  }
  if (field.pattern && formatted) {
    try {
      if (!new RegExp(field.pattern).test(formatted)) {
        pushIssue(ctx, {
          code: ISSUE_CODES.CONSTRAINT,
          severity: 'error',
          fieldId,
          message: `Field "${field.id}" failed pattern ${field.pattern}`,
        });
      }
    } catch {
      /* invalid author regex */
    }
  }
  if (field.maxChars && formatted.length > field.maxChars) {
    pushIssue(ctx, {
      code: ISSUE_CODES.CONSTRAINT,
      severity: 'error',
      fieldId,
      message: `Field "${field.id}" exceeds maxChars ${field.maxChars}`,
    });
  }
}

function checkOverflow(ctx: CompileCtx, op: TextDrawOp) {
  const layout = layoutText(op, helveticaMeasurer);
  const pad = effectivePadding(op.rect, op.style.padding);
  const innerWidth = Math.max(0, op.rect.width - pad.left - pad.right);
  const tooWide = layout.lines.some(
    (line) => helveticaMeasurer.widthOf(line.text, layout.fontSize) > innerWidth + 0.5,
  );
  if (tooWide) {
    pushIssue(ctx, {
      code: ISSUE_CODES.OVERFLOW,
      severity: 'warning',
      fieldId: op.fieldId,
      message: `Text overflows box for "${op.fieldId}"`,
    });
  }
}

function makeTrace(
  fieldId: string,
  copyId: string | undefined,
  raw: unknown,
  formatted: string,
  binding?: Binding,
): DrawTrace {
  return {
    fieldId,
    ...(copyId ? { copyId } : {}),
    raw,
    formatted,
    ...(binding ? { binding } : {}),
    ...(binding?.transforms ? { transforms: binding.transforms } : {}),
  };
}

function valueFieldOps(
  field: ValueField,
  resolveCtx: ResolveContext,
  page: PageSize,
  dpi: number,
  offset: Offset,
  ctx: CompileCtx,
): DrawOp[] {
  const fieldId = qualify(field.id, ctx.copyId);
  checkUnbound(ctx, fieldId, field.binding);
  const detailed = resolveBindingDetailed(field.binding, resolveCtx);
  if (detailed.typeMismatch) {
    pushIssue(ctx, {
      code: ISSUE_CODES.TYPE_MISMATCH,
      severity: 'error',
      fieldId,
      message: detailed.typeMismatch,
    });
  }
  checkMissing(ctx, fieldId, field.binding, detailed.value);
  const text = formatValue(detailed.value, field.format);
  checkConstraints(ctx, field, detailed.value, text);
  if (text === '') return [];
  const op: TextDrawOp = {
    kind: 'text',
    fieldId,
    rect: placeRect(field.rect, page, dpi, offset),
    text,
    style: resolveStyle(field.style),
    trace: makeTrace(fieldId, ctx.copyId, detailed.value, text, field.binding),
  };
  checkOverflow(ctx, op);
  return [op];
}

function checkboxOps(
  field: CheckboxField,
  resolveCtx: ResolveContext,
  page: PageSize,
  dpi: number,
  offset: Offset,
  ctx: CompileCtx,
): DrawOp[] {
  const fieldId = qualify(field.id, ctx.copyId);
  checkUnbound(ctx, fieldId, field.binding);
  const detailed = resolveBindingDetailed(field.binding, resolveCtx);
  if (!isChecked(field, detailed.value)) return [];
  const formatted = field.markText;
  return [
    {
      kind: 'mark',
      fieldId,
      rect: placeRect(field.rect, page, dpi, offset),
      mark: field.mark,
      markText: field.markText,
      color: resolveStyle(field.style).color,
      trace: makeTrace(fieldId, ctx.copyId, detailed.value, formatted, field.binding),
    },
  ];
}

function radioOps(
  field: RadioField,
  resolveCtx: ResolveContext,
  page: PageSize,
  dpi: number,
  offset: Offset,
  ctx: CompileCtx,
): DrawOp[] {
  const fieldId = qualify(field.id, ctx.copyId);
  checkUnbound(ctx, fieldId, field.binding);
  const detailed = resolveBindingDetailed(field.binding, resolveCtx);
  if (detailed.value !== field.option) return [];
  return [
    {
      kind: 'mark',
      fieldId,
      rect: placeRect(field.rect, page, dpi, offset),
      mark: field.mark,
      markText: field.markText,
      color: resolveStyle(field.style).color,
      trace: makeTrace(fieldId, ctx.copyId, detailed.value, field.markText, field.binding),
    },
  ];
}

function combOps(
  field: CombField,
  resolveCtx: ResolveContext,
  page: PageSize,
  dpi: number,
  offset: Offset,
  ctx: CompileCtx,
): DrawOp[] {
  const fieldId = qualify(field.id, ctx.copyId);
  checkUnbound(ctx, fieldId, field.binding);
  const detailed = resolveBindingDetailed(field.binding, resolveCtx);
  checkMissing(ctx, fieldId, field.binding, detailed.value);
  const text = formatValue(detailed.value, field.format);
  checkConstraints(ctx, field, detailed.value, text);
  if (text === '') return [];
  if (text.length > field.cells) {
    pushIssue(ctx, {
      code: ISSUE_CODES.COMB_TRUNCATED,
      severity: 'warning',
      fieldId,
      message: `Comb "${field.id}" truncated (${text.length} > ${field.cells} cells)`,
      data: { length: text.length, cells: field.cells },
    });
  }

  const base = placeRect(field.rect, page, dpi, offset);
  const cellWidth = base.width / field.cells;
  const style: Style = { ...resolveStyle(field.style), align: 'center' };
  const chars = text.split('');
  const startCell = field.alignRight ? Math.max(0, field.cells - chars.length) : 0;
  const gutter = (cellWidth * field.cellGap) / 2;
  const ops: TextDrawOp[] = [];
  for (let i = 0; i < chars.length && startCell + i < field.cells; i++) {
    const ch = chars[i]!;
    if (ch === ' ') continue;
    const cellIndex = startCell + i;
    ops.push({
      kind: 'text',
      fieldId: `${fieldId}[${cellIndex}]`,
      rect: {
        x: base.x + cellIndex * cellWidth + gutter,
        y: base.y,
        width: cellWidth - gutter * 2,
        height: base.height,
        rotation: base.rotation,
      },
      text: ch,
      style,
      trace: makeTrace(fieldId, ctx.copyId, detailed.value, text, field.binding),
    });
  }
  return ops;
}

function statementOps(
  group: RepeatingGroup,
  leftover: number,
  page: PageSize,
  dpi: number,
  offset: Offset,
  ctx: CompileCtx,
): DrawOp[] {
  const overflow = group.overflow;
  if (!overflow || overflow.strategy !== 'statement' || leftover <= 0) return [];
  const text = overflow.statementText ?? 'See attached';
  const target = overflow.statementFieldId
    ? ctx.pageFields.find((f) => f.id === overflow.statementFieldId)
    : undefined;
  if (!target || target.type === 'repeat') return [];
  const fieldId = qualify(target.id, ctx.copyId);
  const op: TextDrawOp = {
    kind: 'text',
    fieldId,
    rect: placeRect(target.rect, page, dpi, offset),
    text,
    style: resolveStyle(target.style),
    trace: makeTrace(fieldId, ctx.copyId, leftover, text),
  };
  return [op];
}

interface RepeatResult {
  ops: DrawOp[];
  extraPages: RenderPage[];
}

function repeatOps(
  group: RepeatingGroup,
  resolveCtx: ResolveContext,
  page: PageSize,
  dpi: number,
  offset: Offset,
  ctx: CompileCtx,
  pageMeta: { number: number; backgroundRef: number | string },
): RepeatResult {
  const items = resolveArray(group.itemsPath, resolveCtx);
  const fieldId = qualify(group.id, ctx.copyId);
  if (isUnboundPath(group.itemsPath)) {
    pushIssue(ctx, {
      code: ISSUE_CODES.UNBOUND,
      severity: 'warning',
      fieldId,
      path: group.itemsPath,
      message: `Repeat "${group.id}" is unbound`,
    });
  }
  if (items.length === 0) return { ops: [], extraPages: [] };

  const groupOrigin = placeRect(group.rect, page, dpi, offset);
  const rowHeightPt = rectToPoints(
    { ...group.rect, y: group.rowHeight, height: group.rowHeight },
    page,
    dpi,
  ).y;

  const strategy = group.overflow?.strategy ?? 'clip';
  const maxRows = group.maxRows;
  const firstCount = maxRows ? Math.min(items.length, maxRows) : items.length;
  const leftover = items.length - firstCount;

  if (leftover > 0 && strategy !== 'paginate') {
    pushIssue(ctx, {
      code: ISSUE_CODES.REPEAT_OVERFLOW,
      severity: 'warning',
      fieldId,
      message: `Repeat "${group.id}" overflowed by ${leftover} row(s)`,
      data: { leftover, strategy },
    });
  }

  const emitRows = (slice: unknown[], origin: Offset): DrawOp[] => {
    const ops: DrawOp[] = [];
    for (let row = 0; row < slice.length; row++) {
      const rowCtx: ResolveContext = { root: resolveCtx.root, row: slice[row] };
      const rowOffset: Offset = { dx: origin.dx, dy: origin.dy + row * rowHeightPt };
      for (const child of group.fields) {
        ops.push(...dispatch(child, rowCtx, page, dpi, rowOffset, ctx).ops);
      }
    }
    return ops;
  };

  const ops = emitRows(items.slice(0, firstCount), { dx: groupOrigin.x, dy: groupOrigin.y });
  ops.push(...statementOps(group, leftover, page, dpi, ZERO, ctx));

  const extraPages: RenderPage[] = [];
  if (strategy === 'paginate' && leftover > 0 && maxRows) {
      let rest = items.slice(firstCount);
      while (rest.length > 0) {
      const chunk = rest.slice(0, maxRows);
      rest = rest.slice(maxRows);
        extraPages.push({
          number: pageMeta.number,
          copyId: ctx.copyId,
          size: page,
          backgroundRef: pageMeta.backgroundRef,
          ops: emitRows(chunk, { dx: groupOrigin.x, dy: groupOrigin.y }),
        });
      }
  }

  return { ops, extraPages };
}

function resolveArray(path: string, ctx: ResolveContext): unknown[] {
  const value = queryJsonPath(path, ctx);
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}

function dispatch(
  field: Field | ValueField | CheckboxField | CombField | RadioField,
  resolveCtx: ResolveContext,
  page: PageSize,
  dpi: number,
  offset: Offset,
  ctx: CompileCtx,
  pageMeta?: { number: number; backgroundRef: number | string },
): RepeatResult {
  switch (field.type) {
    case 'value':
      return { ops: valueFieldOps(field, resolveCtx, page, dpi, offset, ctx), extraPages: [] };
    case 'checkbox':
      return { ops: checkboxOps(field, resolveCtx, page, dpi, offset, ctx), extraPages: [] };
    case 'radio':
      return { ops: radioOps(field, resolveCtx, page, dpi, offset, ctx), extraPages: [] };
    case 'comb':
      return { ops: combOps(field, resolveCtx, page, dpi, offset, ctx), extraPages: [] };
    case 'repeat':
      return repeatOps(
        field,
        resolveCtx,
        page,
        dpi,
        offset,
        ctx,
        pageMeta ?? { number: 1, backgroundRef: 0 },
      );
  }
}

const DEFAULT_COPY: FormCopy = { id: '' };

export function compileTemplate(template: FormTemplate, data: unknown): CompileResult {
  const dpi = template.medium.dpi;
  const issues: Issue[] = [];
  const copies = template.copies?.length ? template.copies : [DEFAULT_COPY];
  const pages: RenderPage[] = [];

  for (const copy of copies) {
    const copyId = copy.id || undefined;
    for (const page of template.pages) {
      if (copy.pageFilter && !copy.pageFilter.includes(page.number)) continue;
      const size = page.size ?? template.pageSize;
      const resolveCtx: ResolveContext = { root: data };
      const ctx: CompileCtx = { issues, copyId, pageFields: page.fields };
      const ops: DrawOp[] = [];
      const extraPages: RenderPage[] = [];
      const backgroundRef = page.backgroundRef ?? page.number - 1;
      const statementTargets = new Set(
        page.fields
          .filter((f): f is RepeatingGroup => f.type === 'repeat')
          .map((f) => f.overflow?.statementFieldId)
          .filter((id): id is string => Boolean(id)),
      );
      for (const field of page.fields) {
        if (statementTargets.has(field.id)) continue;
        if (field.condition && !evaluateCondition(field.condition, resolveCtx)) continue;
        const result = dispatch(field, resolveCtx, size, dpi, ZERO, ctx, {
          number: page.number,
          backgroundRef,
        });
        ops.push(...result.ops);
        extraPages.push(...result.extraPages);
      }
      pages.push({
        number: page.number,
        ...(copyId ? { copyId, copyTitle: copy.title } : {}),
        size,
        backgroundRef,
        ops,
      });
      pages.push(...extraPages);
    }
  }

  return {
    plan: { templateId: template.id, medium: template.medium.kind, dpi, pages },
    issues,
    coverage: coverage(template, data),
  };
}

export function planTemplate(template: FormTemplate, data: unknown): RenderPlan {
  return compileTemplate(template, data).plan;
}
