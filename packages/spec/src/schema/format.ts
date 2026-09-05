import { z } from 'zod';

/** IRS/accounting convention: negatives as `(1,234.00)`. */
export const NegativeStyle = z.enum(['minus', 'parentheses', 'none']);
export type NegativeStyle = z.infer<typeof NegativeStyle>;

export const FormatSpec = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }).strict(),

  z
    .object({
      type: z.literal('text'),
      case: z.enum(['upper', 'lower', 'title', 'none']).default('none'),
      maxLength: z.number().int().positive().optional(),
    })
    .strict(),

  z
    .object({
      type: z.literal('currency'),
      locale: z.string().default('en-US'),
      currency: z.string().length(3).default('USD'),
      decimals: z.number().int().min(0).max(4).default(2),
      symbol: z.boolean().default(false),
      grouping: z.boolean().default(true),
      negative: NegativeStyle.default('parentheses'),
      zeroAs: z.string().optional(),
    })
    .strict(),

  z
    .object({
      type: z.literal('number'),
      locale: z.string().default('en-US'),
      decimals: z.number().int().min(0).max(6).default(0),
      grouping: z.boolean().default(false),
      negative: NegativeStyle.default('minus'),
    })
    .strict(),

  z
    .object({
      type: z.literal('percent'),
      locale: z.string().default('en-US'),
      decimals: z.number().int().min(0).max(4).default(2),
      /** Multiply by 100 before display (ratio → percent). */
      scale: z.boolean().default(false),
    })
    .strict(),

  z
    .object({
      type: z.literal('date'),
      inputFormat: z.string().optional(),
      outputFormat: z.string().default('MM/DD/YYYY'),
      locale: z.string().default('en-US'),
    })
    .strict(),

  z
    .object({
      type: z.literal('ssn'),
      mask: z.boolean().default(false),
    })
    .strict(),

  z.object({ type: z.literal('ein') }).strict(),

  z.object({ type: z.literal('phone') }).strict(),

  z
    .object({
      type: z.literal('boolean'),
      trueText: z.string().default('X'),
      falseText: z.string().default(''),
    })
    .strict(),
]);
export type FormatSpec = z.infer<typeof FormatSpec>;
