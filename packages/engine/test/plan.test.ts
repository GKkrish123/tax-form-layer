import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertTemplate } from '@tax-form-layer/spec';
import { planTemplate } from '../src/plan/plan.js';
import { renderPdf } from '../src/renderers/pdf.js';

const here = dirname(fileURLToPath(import.meta.url));
const w2 = JSON.parse(
  readFileSync(resolve(here, '../../spec/examples/w2-2024.annotation.json'), 'utf8'),
);

describe('planTemplate', () => {
  const template = assertTemplate(w2);
  const plan = planTemplate(template, template.sampleData);

  it('produces one page of ops', () => {
    expect(plan.pages).toHaveLength(1);
    expect(plan.templateId).toBe('irs-w2-2024');
  });

  it('resolves and formats a currency box', () => {
    const box1 = plan.pages[0]!.ops.find((o) => o.kind === 'text' && o.fieldId === 'box1_wages');
    expect(box1).toBeDefined();
    if (box1?.kind === 'text') expect(box1.text).toBe('84,250.75');
  });

  it('formats the SSN box', () => {
    const ssn = plan.pages[0]!.ops.find((o) => o.kind === 'text' && o.fieldId === 'employee_ssn');
    if (ssn?.kind === 'text') expect(ssn.text).toBe('123-45-6789');
  });

  it('emits a mark op for the checked retirement box', () => {
    const mark = plan.pages[0]!.ops.find((o) => o.kind === 'mark');
    expect(mark).toBeDefined();
    if (mark?.kind === 'mark') expect(mark.mark).toBe('cross');
  });

  it('expands the repeating state group into rows', () => {
    const stateCodes = plan.pages[0]!.ops.filter(
      (o) => o.kind === 'text' && o.fieldId.startsWith('state_code'),
    );
    expect(stateCodes.length).toBeGreaterThanOrEqual(1);
  });

  it('positions boxes in points anchored to page size', () => {
    const box1 = plan.pages[0]!.ops.find((o) => o.kind === 'text' && o.fieldId === 'box1_wages');
    if (box1) expect(box1.rect.x).toBeCloseTo(306);
  });
});

describe('renderPdf', () => {
  it('renders the W-2 plan to a valid PDF byte stream', async () => {
    const template = assertTemplate(w2);
    const plan = planTemplate(template, template.sampleData);
    const bytes = await renderPdf(plan);
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
