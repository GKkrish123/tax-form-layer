import { z } from 'zod';
import { Rect } from './geometry.js';
import { Binding } from './binding.js';
import { FormatSpec } from './format.js';
import { Style } from './style.js';

export const Condition = z
  .object({
    path: z.string().min(1),
    operator: z.enum([
      'exists',
      'notExists',
      'truthy',
      'falsy',
      'eq',
      'ne',
      'gt',
      'lt',
      'gte',
      'lte',
    ]),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  })
  .strict();
export type Condition = z.infer<typeof Condition>;

const fieldBase = {
  id: z.string().min(1),
  label: z.string().optional(),
  boxNumber: z.string().optional(),
  rect: Rect,
  style: Style.optional(),
  condition: Condition.optional(),
  note: z.string().optional(),
};

export const ValueField = z
  .object({
    type: z.literal('value'),
    ...fieldBase,
    binding: Binding,
    format: FormatSpec.default({ type: 'none' }),
  })
  .strict();
export type ValueField = z.infer<typeof ValueField>;

export const CheckMark = z.enum(['check', 'cross', 'fill', 'text']);

export const CheckboxField = z
  .object({
    type: z.literal('checkbox'),
    ...fieldBase,
    binding: Binding,
    mark: CheckMark.default('check'),
    checkedWhen: z.union([z.string(), z.number(), z.boolean()]).optional(),
    markText: z.string().default('X'),
  })
  .strict();
export type CheckboxField = z.infer<typeof CheckboxField>;

/** Character-segmented boxes (SSN, EIN, money combs on scannable IRS forms). */
export const CombField = z
  .object({
    type: z.literal('comb'),
    ...fieldBase,
    binding: Binding,
    format: FormatSpec.default({ type: 'none' }),
    cells: z.number().int().positive(),
    cellGap: z.number().min(0).max(0.9).default(0),
    alignRight: z.boolean().default(false),
  })
  .strict();
export type CombField = z.infer<typeof CombField>;

export const RepeatingGroup = z
  .object({
    type: z.literal('repeat'),
    ...fieldBase,
    itemsPath: z.string().min(1),
    rowHeight: z.number().positive(),
    maxRows: z.number().int().positive().optional(),
    /** Child bindings use `@` as the row root, e.g. `@.amount`. Rects are relative to the group. */
    fields: z.array(z.union([ValueField, CheckboxField, CombField])).min(1),
  })
  .strict();
export type RepeatingGroup = z.infer<typeof RepeatingGroup>;

export const Field = z.discriminatedUnion('type', [
  ValueField,
  CheckboxField,
  CombField,
  RepeatingGroup,
]);
export type Field = z.infer<typeof Field>;
