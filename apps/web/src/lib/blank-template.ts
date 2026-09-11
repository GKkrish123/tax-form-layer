import { parseTemplate, SPEC_VERSION, type FormTemplate } from '@tax-form-layer/spec';

export interface NewFormInput {
  title: string;
  jurisdiction: string;
  formNumber: string;
  taxYear: number;
  mediumKind: 'pdf' | 'image';
  source?: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function blankTemplate(input: NewFormInput): FormTemplate {
  const base = slugify(`${input.jurisdiction}-${input.formNumber}-${input.taxYear}`) || 'form';
  const id = `${base}-${Date.now().toString(36)}`;
  const draft = {
    specVersion: SPEC_VERSION,
    id,
    title: input.title,
    templateVersion: '1.0.0',
    form: {
      jurisdiction: input.jurisdiction,
      formNumber: input.formNumber,
      taxYear: input.taxYear,
    },
    medium: { kind: input.mediumKind, ...(input.source ? { source: input.source } : {}) },
    pages: [{ number: 1, backgroundRef: 0, fields: [] }],
    sampleData: {},
  };
  const parsed = parseTemplate(draft);
  if (!parsed.ok) {
    throw new Error(parsed.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
  }
  return parsed.template;
}
