import { z } from 'zod';
import { HorizontalAlign, VerticalAlign } from './geometry.js';

/** Standard PDF fonts need no embedding in every PDF renderer. */
export const StandardFont = z.enum([
  'Helvetica',
  'Helvetica-Bold',
  'Helvetica-Oblique',
  'Helvetica-BoldOblique',
  'Times-Roman',
  'Times-Bold',
  'Times-Italic',
  'Times-BoldItalic',
  'Courier',
  'Courier-Bold',
  'Courier-Oblique',
  'Courier-BoldOblique',
]);
export type StandardFont = z.infer<typeof StandardFont>;

/**
 * - `clip`: draw as-is; renderer may overrun or crop.
 * - `shrink`: reduce font size until it fits (down to `minFontSize`).
 * - `ellipsis`: truncate with `…`.
 * - `wrap`: break onto multiple lines.
 */
export const Overflow = z.enum(['clip', 'shrink', 'ellipsis', 'wrap']);
export type Overflow = z.infer<typeof Overflow>;

export const Padding = z
  .object({
    top: z.number().default(0),
    right: z.number().default(0),
    bottom: z.number().default(0),
    left: z.number().default(0),
  })
  .strict();
export type Padding = z.infer<typeof Padding>;

/** Font size in points — scales correctly across PDF and image mediums via DPI. */
export const Style = z
  .object({
    font: StandardFont.default('Helvetica'),
    fontSize: z.number().positive().default(9),
    minFontSize: z.number().positive().default(5),
    color: z
      .string()
      .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
      .default('#000000'),
    align: HorizontalAlign.default('left'),
    verticalAlign: VerticalAlign.default('middle'),
    letterSpacing: z.number().default(0),
    lineHeight: z.number().positive().default(1.15),
    overflow: Overflow.default('shrink'),
    padding: Padding.optional(),
  })
  .strict();
export type Style = z.infer<typeof Style>;
