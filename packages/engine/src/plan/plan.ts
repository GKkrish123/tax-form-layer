import type {
  FormTemplate,
  Field,
  ValueField,
  CheckboxField,
  CombField,
  RepeatingGroup,
  Style,
  PageSize,
} from '@tax-form-layer/spec';
import { Style as StyleSchema } from '@tax-form-layer/spec';
import {
  resolveBinding,
  queryJsonPath,
  type ResolveContext,
  type ResolvedValue,
} from '../resolve/binding.js';
import { evaluateCondition } from '../resolve/condition.js';
import { formatValue } from '../format/index.js';
import { rectToPoints, type PointRect } from '../geometry/coordinates.js';
import type { DrawOp, RenderPage, RenderPlan, TextDrawOp } from './types.js';

const DEFAULT_STYLE: Style = StyleSchema.parse({});

/**
 * Merge a possibly-partial style (e.g. produced by an editor patching individual
 * properties) with spec defaults, so every draw op carries a complete Style. This
 * guarantees renderers/previews never see an undefined `font`, `color`, etc.
 */
function resolveStyle(style: Partial<Style> | undefined): Style {
  return style ? { ...DEFAULT_STYLE, ...style } : DEFAULT_STYLE;
}

interface Offset {
  dx: number;
  dy: number;
}

const ZERO: Offset = { dx: 0, dy: 0 };

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

function valueFieldOps(
  field: ValueField,
  ctx: ResolveContext,
  page: PageSize,
  dpi: number,
  offset: Offset,
): DrawOp[] {
  const resolved = resolveBinding(field.binding, ctx);
  const text = formatValue(resolved, field.format);
  if (text === '') return [];
  const op: TextDrawOp = {
    kind: 'text',
    fieldId: field.id,
    rect: placeRect(field.rect, page, dpi, offset),
    text,
    style: resolveStyle(field.style),
  };
  return [op];
}

function checkboxOps(
  field: CheckboxField,
  ctx: ResolveContext,
  page: PageSize,
  dpi: number,
  offset: Offset,
): DrawOp[] {
  const resolved = resolveBinding(field.binding, ctx);
  if (!isChecked(field, resolved)) return [];
  return [
    {
      kind: 'mark',
      fieldId: field.id,
      rect: placeRect(field.rect, page, dpi, offset),
      mark: field.mark,
      markText: field.markText,
      color: resolveStyle(field.style).color,
    },
  ];
}

function combOps(
  field: CombField,
  ctx: ResolveContext,
  page: PageSize,
  dpi: number,
  offset: Offset,
): DrawOp[] {
  const resolved = resolveBinding(field.binding, ctx);
  const text = formatValue(resolved, field.format);
  if (text === '') return [];

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
      fieldId: `${field.id}[${cellIndex}]`,
      rect: {
        x: base.x + cellIndex * cellWidth + gutter,
        y: base.y,
        width: cellWidth - gutter * 2,
        height: base.height,
        rotation: base.rotation,
      },
      text: ch,
      style,
    });
  }
  return ops;
}

function repeatOps(
  group: RepeatingGroup,
  ctx: ResolveContext,
  page: PageSize,
  dpi: number,
  offset: Offset,
): DrawOp[] {
  const items = resolveArray(group.itemsPath, ctx);
  if (items.length === 0) return [];

  const groupOrigin = placeRect(group.rect, page, dpi, offset);
  // rowHeight is expressed in the group rect's unit; convert to points vertically.
  const rowHeightPt = rectToPoints(
    { ...group.rect, y: group.rowHeight, height: group.rowHeight },
    page,
    dpi,
  ).y;

  const limit = group.maxRows ? Math.min(items.length, group.maxRows) : items.length;
  const ops: DrawOp[] = [];

  for (let row = 0; row < limit; row++) {
    const rowCtx: ResolveContext = { root: ctx.root, row: items[row] };
    const rowOffset: Offset = { dx: groupOrigin.x, dy: groupOrigin.y + row * rowHeightPt };
    for (const child of group.fields) {
      ops.push(...dispatch(child, rowCtx, page, dpi, rowOffset));
    }
  }
  return ops;
}

function resolveArray(path: string, ctx: ResolveContext): unknown[] {
  const value = queryJsonPath(path, ctx);
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}

function dispatch(
  field: Field | ValueField | CheckboxField | CombField,
  ctx: ResolveContext,
  page: PageSize,
  dpi: number,
  offset: Offset,
): DrawOp[] {
  switch (field.type) {
    case 'value':
      return valueFieldOps(field, ctx, page, dpi, offset);
    case 'checkbox':
      return checkboxOps(field, ctx, page, dpi, offset);
    case 'comb':
      return combOps(field, ctx, page, dpi, offset);
    case 'repeat':
      return repeatOps(field, ctx, page, dpi, offset);
  }
}

export function planTemplate(template: FormTemplate, data: unknown): RenderPlan {
  const dpi = template.medium.dpi;
  const pages: RenderPage[] = template.pages.map((page) => {
    const size = page.size ?? template.pageSize;
    const ctx: ResolveContext = { root: data };
    const ops: DrawOp[] = [];
    for (const field of page.fields) {
      if (field.condition && !evaluateCondition(field.condition, ctx)) continue;
      ops.push(...dispatch(field, ctx, size, dpi, ZERO));
    }
    return {
      number: page.number,
      size,
      backgroundRef: page.backgroundRef ?? page.number - 1,
      ops,
    };
  });

  return { templateId: template.id, medium: template.medium.kind, dpi, pages };
}
