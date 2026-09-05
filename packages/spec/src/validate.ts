import { z } from 'zod';
import { FormTemplate } from './schema/template.js';
import { SPEC_VERSION } from './version.js';
import { migrateToLatest, isKnownSpecVersion } from './migrations/index.js';

export interface ValidationSuccess {
  ok: true;
  template: FormTemplate;
  migrated: boolean;
}

export interface ValidationFailure {
  ok: false;
  errors: Array<{ path: string; message: string }>;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

function flatten(error: z.ZodError): ValidationFailure['errors'] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

export function parseTemplate(input: unknown): ValidationResult {
  let candidate = input;
  let migrated = false;

  if (
    typeof input === 'object' &&
    input !== null &&
    'specVersion' in input &&
    typeof (input as { specVersion: unknown }).specVersion === 'string'
  ) {
    const declared = (input as { specVersion: string }).specVersion;
    if (declared !== SPEC_VERSION) {
      if (!isKnownSpecVersion(declared)) {
        return {
          ok: false,
          errors: [
            {
              path: 'specVersion',
              message: `Unknown spec version "${declared}". Latest supported is "${SPEC_VERSION}".`,
            },
          ],
        };
      }
      candidate = migrateToLatest(input as Record<string, unknown>, declared);
      migrated = true;
    }
  }

  const result = FormTemplate.safeParse(candidate);
  if (!result.success) {
    return { ok: false, errors: flatten(result.error) };
  }
  return { ok: true, template: result.data, migrated };
}

export function assertTemplate(input: unknown): FormTemplate {
  const result = parseTemplate(input);
  if (!result.ok) {
    const detail = result.errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n');
    throw new Error(`Invalid tax form template:\n${detail}`);
  }
  return result.template;
}
