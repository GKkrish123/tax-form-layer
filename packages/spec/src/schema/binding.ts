import { z } from 'zod';

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

export const Binding = z.discriminatedUnion('source', [
  z
    .object({
      source: z.literal('jsonpath'),
      path: z.string().min(1),
      ...bindingBase,
    })
    .strict(),
  z
    .object({
      source: z.literal('pointer'),
      pointer: z.string().startsWith('/'),
      ...bindingBase,
    })
    .strict(),
  z
    .object({
      source: z.literal('const'),
      value: z.union([z.string(), z.number(), z.boolean()]),
      ...bindingBase,
    })
    .strict(),
  z
    .object({
      source: z.literal('template'),
      template: z.string().min(1),
      ...bindingBase,
    })
    .strict(),
]);
export type Binding = z.infer<typeof Binding>;
