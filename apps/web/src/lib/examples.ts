import type { FormTemplate } from '@tax-form-layer/spec';
import { parseTemplate } from '@tax-form-layer/spec';
import w2 from '@tax-form-layer/spec/examples/w2-2024';
import nec from '@tax-form-layer/spec/examples/1099-nec-2024';
import int2024 from '@tax-form-layer/spec/examples/1099-int-2024';
import misc from '@tax-form-layer/spec/examples/1099-misc-2024';
import w9 from '@tax-form-layer/spec/examples/w9-2024';
import w4 from '@tax-form-layer/spec/examples/w4-2024';

export interface BundledExample {
  id: string;
  title: string;
  formNumber: string;
  pdf: string;
  document: unknown;
}

export const BUNDLED_EXAMPLES: BundledExample[] = [
  {
    id: 'irs-w2-2024',
    title: 'IRS Form W-2 (2024)',
    formNumber: 'W-2',
    pdf: '/forms/w2-2024.pdf',
    document: w2,
  },
  {
    id: 'irs-w4-2024',
    title: 'IRS Form W-4 (2024)',
    formNumber: 'W-4',
    pdf: '/forms/w4-2024.pdf',
    document: w4,
  },
  {
    id: 'irs-w9-2024',
    title: 'IRS Form W-9 (2024)',
    formNumber: 'W-9',
    pdf: '/forms/w9-2024.pdf',
    document: w9,
  },
  {
    id: 'irs-1099-nec-2024',
    title: 'IRS Form 1099-NEC (2024)',
    formNumber: '1099-NEC',
    pdf: '/forms/1099-nec-2024.pdf',
    document: nec,
  },
  {
    id: 'irs-1099-int-2024',
    title: 'IRS Form 1099-INT (2024)',
    formNumber: '1099-INT',
    pdf: '/forms/1099-int-2024.pdf',
    document: int2024,
  },
  {
    id: 'irs-1099-misc-2024',
    title: 'IRS Form 1099-MISC (2024)',
    formNumber: '1099-MISC',
    pdf: '/forms/1099-misc-2024.pdf',
    document: misc,
  },
];

export function parseBundledExample(example: BundledExample): FormTemplate {
  const parsed = parseTemplate(example.document);
  if (!parsed.ok) {
    throw new Error(parsed.errors[0]?.message ?? `Invalid example ${example.id}`);
  }
  return parsed.template;
}
