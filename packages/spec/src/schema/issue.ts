import { z } from 'zod';

/** Stable compiler diagnostic codes. Studio and CI consume the same catalog. */
export const ISSUE_CODES = {
  UNBOUND: 'TFL-BIND-001',
  MISSING: 'TFL-BIND-002',
  TYPE_MISMATCH: 'TFL-BIND-003',
  OVERFLOW: 'TFL-OVR-001',
  COMB_TRUNCATED: 'TFL-OVR-002',
  REPEAT_OVERFLOW: 'TFL-OVR-003',
  CONSTRAINT: 'TFL-CON-001',
} as const;

export type IssueCode = (typeof ISSUE_CODES)[keyof typeof ISSUE_CODES];

export const IssueSeverity = z.enum(['error', 'warning', 'info']);
export type IssueSeverity = z.infer<typeof IssueSeverity>;

export const Issue = z
  .object({
    code: z.string().min(1),
    severity: IssueSeverity,
    fieldId: z.string().optional(),
    path: z.string().optional(),
    message: z.string().min(1),
    data: z.record(z.unknown()).optional(),
  })
  .strict();
export type Issue = z.infer<typeof Issue>;
