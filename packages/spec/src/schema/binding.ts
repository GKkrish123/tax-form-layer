import { z } from 'zod';
import { Condition } from './condition.js';

export const Transform = z.discriminatedUnion('op', [
  z.object({ op: z.literal('trim') }).strict(),
  z.object({ op: z.literal('uppercase') }).strict(),
  z.object({ op: z.literal('lowercase') }).strict(),
  z.object({ op: z.literal('abs') }).strict(),
  z.object({ op: z.literal('negate') }).strict(),
  z.object({ op: z.literal('round'), decimals: z.number().int().min(0).default(0) }).strict(),
  z.object({ op: z.literal('multiply'), by: z.number() }).strict(),
  z.object({ op: z.literal('divide'), by: z.number() }).strict(),
  z
    .object({ op: z.literal('slice'), start: z.number().int(), end: z.number().int().optional() })
    .strict(),
  z
    .object({
      op: z.literal('replace'),
      pattern: z.string(),
      replacement: z.string(),
      regex: z.boolean().default(false),
    })
    .strict(),
  z
    .object({ op: z.literal('coalesce'), value: z.union([z.string(), z.number(), z.boolean()]) })
    .strict(),
]);
export type Transform = z.infer<typeof Transform>;

const bindingBase = {
  fallback: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  transforms: z.array(Transform).optional(),
};

export const JsonPathBinding = z
  .object({
    source: z.literal('jsonpath'),
    path: z.string().min(1),
    ...bindingBase,
  })
  .strict();

export const PointerBinding = z
  .object({
    source: z.literal('pointer'),
    pointer: z.string().startsWith('/'),
    ...bindingBase,
  })
  .strict();

export const ConstBinding = z
  .object({
    source: z.literal('const'),
    value: z.union([z.string(), z.number(), z.boolean()]),
    ...bindingBase,
  })
  .strict();

export const TemplateBinding = z
  .object({
    source: z.literal('template'),
    template: z.string().min(1),
    ...bindingBase,
  })
  .strict();

export type ArithmeticOp = 'sum' | 'add' | 'sub' | 'mul' | 'div';

export type Binding =
  | z.infer<typeof JsonPathBinding>
  | z.infer<typeof PointerBinding>
  | z.infer<typeof ConstBinding>
  | z.infer<typeof TemplateBinding>
  | {
      source: 'computed';
      op: ArithmeticOp;
      args: Binding[];
      fallback?: string | number | boolean | null;
      transforms?: Transform[];
    }
  | {
      source: 'computed';
      op: 'if';
      condition: Condition;
      then: Binding;
      else: Binding;
      fallback?: string | number | boolean | null;
      transforms?: Transform[];
    };

export const Binding: z.ZodType<Binding> = z.lazy(() =>
  z.union([
    JsonPathBinding,
    PointerBinding,
    ConstBinding,
    TemplateBinding,
    z
      .object({
        source: z.literal('computed'),
        op: z.enum(['sum', 'add', 'sub', 'mul', 'div']),
        args: z.array(Binding).min(1),
        ...bindingBase,
      })
      .strict(),
    z
      .object({
        source: z.literal('computed'),
        op: z.literal('if'),
        condition: Condition,
        then: Binding,
        else: Binding,
        ...bindingBase,
      })
      .strict(),
  ]),
) as z.ZodType<Binding>;
