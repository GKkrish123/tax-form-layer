import { z } from 'zod';

/**
 * - `fraction` (default): [0, 1] relative to page width/height — medium-agnostic.
 * - `pt`: absolute PostScript points (1/72 inch).
 * - `px`: absolute pixels at the page's declared DPI.
 */
export const CoordinateUnit = z.enum(['fraction', 'pt', 'px']);
export type CoordinateUnit = z.infer<typeof CoordinateUnit>;

/** Top-left origin; renderers convert to medium-native space (e.g. PDF bottom-left). */
export const Rect = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    rotation: z.number().default(0),
    unit: CoordinateUnit.default('fraction'),
  })
  .strict();
export type Rect = z.infer<typeof Rect>;

/** Tax forms typically right-align monetary amounts. */
export const HorizontalAlign = z.enum(['left', 'center', 'right']);
export type HorizontalAlign = z.infer<typeof HorizontalAlign>;

export const VerticalAlign = z.enum(['top', 'middle', 'bottom']);
export type VerticalAlign = z.infer<typeof VerticalAlign>;
