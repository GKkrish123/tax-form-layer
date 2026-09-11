import { z } from 'zod';

export const ConditionOperator = z.enum([
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
]);
export type ConditionOperator = z.infer<typeof ConditionOperator>;

export const LeafCondition = z
  .object({
    path: z.string().min(1),
    operator: ConditionOperator,
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  })
  .strict();
export type LeafCondition = z.infer<typeof LeafCondition>;

export type Condition =
  | LeafCondition
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export const Condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    LeafCondition,
    z.object({ all: z.array(Condition).min(1) }).strict(),
    z.object({ any: z.array(Condition).min(1) }).strict(),
    z.object({ not: Condition }).strict(),
  ]),
) as z.ZodType<Condition>;

export function isLeafCondition(c: Condition): c is LeafCondition {
  return 'path' in c && 'operator' in c;
}
