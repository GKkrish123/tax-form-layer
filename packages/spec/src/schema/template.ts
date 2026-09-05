import { z } from 'zod';
import { Field } from './field.js';

/** Page size in points; anchors fractional coordinates to physical dimensions. */
export const PageSize = z
  .object({
    width: z.number().positive().default(612),
    height: z.number().positive().default(792),
  })
  .strict();
export type PageSize = z.infer<typeof PageSize>;

export const Medium = z
  .object({
    kind: z.enum(['pdf', 'image']),
    source: z.string().optional(),
    /** Ignored for PDF. */
    dpi: z.number().positive().default(150),
  })
  .strict();
export type Medium = z.infer<typeof Medium>;

export const Page = z
  .object({
    number: z.number().int().positive(),
    size: PageSize.optional(),
    /** 0-based PDF page index or image asset id; defaults to `number - 1`. */
    backgroundRef: z.union([z.number().int().nonnegative(), z.string()]).optional(),
    fields: z.array(Field).default([]),
  })
  .strict();
export type Page = z.infer<typeof Page>;

export const FormIdentity = z
  .object({
    jurisdiction: z.string().min(1),
    formNumber: z.string().min(1),
    taxYear: z.number().int(),
    edition: z.string().optional(),
  })
  .strict();
export type FormIdentity = z.infer<typeof FormIdentity>;

export const TemplateMetadata = z
  .object({
    author: z.string().optional(),
    description: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict();
export type TemplateMetadata = z.infer<typeof TemplateMetadata>;

export const FormTemplate = z
  .object({
    specVersion: z.string().min(1),
    id: z.string().min(1),
    title: z.string().min(1),
    templateVersion: z.string().min(1).default('1.0.0'),
    form: FormIdentity,
    medium: Medium,
    pageSize: PageSize.default({ width: 612, height: 792 }),
    pages: z.array(Page).min(1),
    metadata: TemplateMetadata.optional(),
    sampleData: z.unknown().optional(),
  })
  .strict();
export type FormTemplate = z.infer<typeof FormTemplate>;
