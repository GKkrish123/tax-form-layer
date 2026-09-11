import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertTemplate, ISSUE_CODES } from '@tax-form-layer/spec';
import { planTemplate } from '../src/plan/plan.js';
import { compileTemplate } from '../src/plan/plan.js';
import { collectPaths, coverage, toDataJsonSchema } from '../src/plan/coverage.js';
import { renderPdf } from '../src/renderers/pdf.js';
import { renderPng } from '../src/renderers/png.js';
import { rectToPoints, toPdfRect } from '../src/geometry/coordinates.js';

const here = dirname(fileURLToPath(import.meta.url));
const w2 = JSON.parse(
  readFileSync(resolve(here, '../../spec/examples/w2-2024.annotation.json'), 'utf8'),
);

describe('planTemplate', () => {
  const template = assertTemplate(w2);
  const plan = planTemplate(template, template.sampleData);

  it('produces one page per copy', () => {
    expect(plan.pages).toHaveLength(2);
    expect(plan.templateId).toBe('irs-w2-2024');
    expect(plan.pages[0]!.copyId).toBe('B');
    expect(plan.pages[1]!.copyId).toBe('C');
  });

  it('resolves and formats a currency box', () => {
    const box1 = plan.pages[0]!.ops.find((o) => o.kind === 'text' && o.fieldId === 'B:box1_wages');
    expect(box1).toBeDefined();
    if (box1?.kind === 'text') expect(box1.text).toBe('84,250.75');
  });

  it('formats the SSN box', () => {
    const ssn = plan.pages[0]!.ops.find((o) => o.kind === 'text' && o.fieldId === 'B:employee_ssn');
    if (ssn?.kind === 'text') expect(ssn.text).toBe('123-45-6789');
  });

  it('emits a mark op for the checked retirement box', () => {
    const mark = plan.pages[0]!.ops.find((o) => o.kind === 'mark');
    expect(mark).toBeDefined();
    if (mark?.kind === 'mark') expect(mark.mark).toBe('cross');
  });

  it('expands the repeating state group into rows', () => {
    const stateCodes = plan.pages[0]!.ops.filter(
      (o) => o.kind === 'text' && o.fieldId.includes('state_code'),
    );
    expect(stateCodes.length).toBeGreaterThanOrEqual(1);
  });

  it('positions boxes in points anchored to page size', () => {
    const box1 = plan.pages[0]!.ops.find((o) => o.kind === 'text' && o.fieldId === 'B:box1_wages');
    if (box1) expect(box1.rect.x).toBeCloseTo(306);
  });

  it('attaches provenance traces', () => {
    const box1 = plan.pages[0]!.ops.find((o) => o.kind === 'text' && o.fieldId === 'B:box1_wages');
    expect(box1?.trace?.formatted).toBe('84,250.75');
    expect(box1?.trace?.raw).toBe(84250.75);
  });
});

describe('compileTemplate', () => {
  it('flags unbound jsonpaths', () => {
    const raw = structuredClone(w2);
    raw.specVersion = '1.1.0';
    raw.pages[0].fields[0].binding.path = '$.';
    const template = assertTemplate(raw);
    const { issues } = compileTemplate(template, template.sampleData);
    expect(issues.some((i) => i.code === ISSUE_CODES.UNBOUND)).toBe(true);
  });

  it('flags missing values', () => {
    const template = assertTemplate(w2);
    const { issues } = compileTemplate(template, {});
    expect(issues.some((i) => i.code === ISSUE_CODES.MISSING)).toBe(true);
  });

  it('flags comb truncation', () => {
    const raw = {
      specVersion: '1.1.0',
      id: 'comb-test',
      title: 'Comb',
      form: { jurisdiction: 'US', formNumber: 'X', taxYear: 2024 },
      medium: { kind: 'pdf' },
      pages: [
        {
          number: 1,
          fields: [
            {
              type: 'comb',
              id: 'ssn',
              rect: { x: 0.1, y: 0.1, width: 0.4, height: 0.03 },
              binding: { source: 'const', value: '1234567890' },
              cells: 4,
            },
          ],
        },
      ],
    };
    const template = assertTemplate(raw);
    const { issues } = compileTemplate(template, {});
    expect(issues.some((i) => i.code === ISSUE_CODES.COMB_TRUNCATED)).toBe(true);
  });

  it('computes a sum binding', () => {
    const raw = structuredClone(w2);
    raw.specVersion = '1.1.0';
    raw.pages[0].fields.find((f: { id: string }) => f.id === 'box1_wages').binding = {
      source: 'computed',
      op: 'sum',
      args: [
        { source: 'jsonpath', path: '$.boxes.box1' },
        { source: 'jsonpath', path: '$.boxes.box2' },
      ],
    };
    const template = assertTemplate(raw);
    const plan = planTemplate(template, template.sampleData);
    const box1 = plan.pages[0]!.ops.find((o) => o.fieldId === 'box1_wages');
    if (box1?.kind === 'text') expect(box1.text).toBe('96,880.86');
  });

  it('computes if-bindings', () => {
    const raw = {
      specVersion: '1.1.0',
      id: 'if-test',
      title: 'If',
      form: { jurisdiction: 'US', formNumber: 'X', taxYear: 2024 },
      medium: { kind: 'pdf' },
      pages: [
        {
          number: 1,
          fields: [
            {
              type: 'value',
              id: 'name',
              rect: { x: 0.1, y: 0.1, width: 0.4, height: 0.03 },
              binding: {
                source: 'computed',
                op: 'if',
                condition: { path: '$.joint', operator: 'truthy' },
                then: { source: 'const', value: 'JOINT' },
                else: { source: 'const', value: 'SINGLE' },
              },
            },
          ],
        },
      ],
    };
    const template = assertTemplate(raw);
    const plan = planTemplate(template, { joint: true });
    const op = plan.pages[0]!.ops[0];
    if (op?.kind === 'text') expect(op.text).toBe('JOINT');
  });

  it('evaluates compound conditions', () => {
    const raw = {
      specVersion: '1.1.0',
      id: 'cond',
      title: 'Cond',
      form: { jurisdiction: 'US', formNumber: 'X', taxYear: 2024 },
      medium: { kind: 'pdf' },
      pages: [
        {
          number: 1,
          fields: [
            {
              type: 'value',
              id: 'hidden',
              rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.03 },
              binding: { source: 'const', value: 'NOPE' },
              condition: {
                all: [
                  { path: '$.a', operator: 'eq', value: 1 },
                  { path: '$.b', operator: 'eq', value: 2 },
                ],
              },
            },
          ],
        },
      ],
    };
    const template = assertTemplate(raw);
    expect(planTemplate(template, { a: 1, b: 9 }).pages[0]!.ops).toHaveLength(0);
    expect(planTemplate(template, { a: 1, b: 2 }).pages[0]!.ops).toHaveLength(1);
  });

  it('marks only the matching radio in a group', () => {
    const raw = {
      specVersion: '1.1.0',
      id: 'radio',
      title: 'Radio',
      form: { jurisdiction: 'US', formNumber: 'X', taxYear: 2024 },
      medium: { kind: 'pdf' },
      pages: [
        {
          number: 1,
          fields: [
            {
              type: 'radio',
              id: 'mfj',
              group: 'status',
              option: 'MFJ',
              rect: { x: 0.1, y: 0.1, width: 0.02, height: 0.02 },
              binding: { source: 'jsonpath', path: '$.status' },
            },
            {
              type: 'radio',
              id: 's',
              group: 'status',
              option: 'S',
              rect: { x: 0.2, y: 0.1, width: 0.02, height: 0.02 },
              binding: { source: 'jsonpath', path: '$.status' },
            },
          ],
        },
      ],
    };
    const template = assertTemplate(raw);
    const ops = planTemplate(template, { status: 'MFJ' }).pages[0]!.ops.filter((o) => o.kind === 'mark');
    expect(ops).toHaveLength(1);
    expect(ops[0]?.fieldId).toBe('mfj');
  });

  it('expands copies and prefixes field ids', () => {
    const raw = structuredClone(w2);
    raw.specVersion = '1.1.0';
    raw.copies = [
      { id: 'B', title: 'Copy B', pageFilter: [1] },
      { id: 'C', title: 'Copy C', pageFilter: [1] },
    ];
    const template = assertTemplate(raw);
    const plan = planTemplate(template, template.sampleData);
    expect(plan.pages).toHaveLength(2);
    expect(plan.pages[0]!.copyId).toBe('B');
    expect(plan.pages[0]!.ops.some((o) => o.fieldId.startsWith('B:'))).toBe(true);
    expect(plan.pages[1]!.copyId).toBe('C');
  });

  it('emits statement leftover on repeat overflow', () => {
    const raw = structuredClone(w2);
    raw.sampleData.state.push({ code: 'TX', wages: 1, tax: 1 });
    const template = assertTemplate(raw);
    const compiled = compileTemplate(template, template.sampleData);
    expect(compiled.issues.some((i) => i.code === ISSUE_CODES.REPEAT_OVERFLOW)).toBe(true);
    const stmt = compiled.plan.pages[0]!.ops.find(
      (o) => o.fieldId === 'B:state_see_stmt' && o.kind === 'text',
    );
    expect(stmt && stmt.kind === 'text' && stmt.text).toBe('See attached');
  });

  it('reports type mismatch for computed sum of strings', () => {
    const raw = {
      specVersion: '1.1.0',
      id: 'mm',
      title: 'mm',
      form: { jurisdiction: 'US', formNumber: 'X', taxYear: 2024 },
      medium: { kind: 'pdf' },
      pages: [
        {
          number: 1,
          fields: [
            {
              type: 'value',
              id: 't',
              rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.03 },
              binding: {
                source: 'computed',
                op: 'sum',
                args: [{ source: 'const', value: 'nope' }],
              },
            },
          ],
        },
      ],
    };
    const { issues } = compileTemplate(assertTemplate(raw), {});
    expect(issues.some((i) => i.code === ISSUE_CODES.TYPE_MISMATCH)).toBe(true);
  });
});

describe('coverage + schema', () => {
  const template = assertTemplate(w2);

  it('collects jsonpaths from the W-2', () => {
    const paths = collectPaths(template);
    expect(paths.some((p) => p.includes('employee.ssn'))).toBe(true);
  });

  it('covers sample data', () => {
    const report = coverage(template, template.sampleData);
    expect(report.bound.length).toBeGreaterThan(0);
  });

  it('derives a JSON Schema object', () => {
    const schema = toDataJsonSchema(template);
    expect(schema.type).toBe('object');
    expect(schema.properties).toBeDefined();
  });
});

describe('bundled examples', () => {
  it.each(['w4-2024', 'w9-2024', '1099-nec-2024', '1099-int-2024', '1099-misc-2024'])(
    'plans %s with sampleData',
    (slug) => {
      const raw = JSON.parse(
        readFileSync(resolve(here, `../../spec/examples/${slug}.annotation.json`), 'utf8'),
      );
      const template = assertTemplate(raw);
      const { plan, issues } = compileTemplate(template, template.sampleData);
      expect(plan.pages.length).toBeGreaterThan(0);
      expect(plan.pages[0]!.ops.length).toBeGreaterThan(0);
      expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    },
  );
});

describe('golden RenderPlan', () => {
  it('locks formatted W-2 box values', () => {
    const template = assertTemplate(w2);
    const plan = planTemplate(template, template.sampleData);
    const texts = plan.pages[0]!.ops
      .filter((o): o is typeof o & { kind: 'text' } => o.kind === 'text')
      .map((o) => [o.fieldId, o.text] as const)
      .sort((a, b) => a[0].localeCompare(b[0]));
    expect(texts).toMatchInlineSnapshot(`
      [
        [
          "B:box1_wages",
          "84,250.75",
        ],
        [
          "B:box2_fed_withheld",
          "12,630.11",
        ],
        [
          "B:box3_ss_wages",
          "84,250.75",
        ],
        [
          "B:box4_ss_withheld",
          "5,223.55",
        ],
        [
          "B:employee_name",
          "JORDAN RIVERA",
        ],
        [
          "B:employee_ssn",
          "123-45-6789",
        ],
        [
          "B:employer_block",
          "Acme Robotics, Inc.
      500 Innovation Way
      Palo Alto, CA 94304",
        ],
        [
          "B:employer_ein",
          "98-1234567",
        ],
        [
          "B:state_code",
          "CA",
        ],
        [
          "B:state_code",
          "NY",
        ],
        [
          "B:state_tax",
          "4,102.33",
        ],
        [
          "B:state_tax",
          "0.00",
        ],
        [
          "B:state_wages",
          "84,250.75",
        ],
        [
          "B:state_wages",
          "0.00",
        ],
      ]
    `);
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

describe('renderPng', () => {
  it('renders a one-box plan to a PNG', () => {
    const template = assertTemplate({
      specVersion: '1.1.0',
      id: 'png',
      title: 'png',
      form: { jurisdiction: 'US', formNumber: 'X', taxYear: 2024 },
      medium: { kind: 'pdf' },
      pageSize: { width: 100, height: 40 },
      pages: [
        {
          number: 1,
          fields: [
            {
              type: 'value',
              id: 'v',
              rect: { x: 0.1, y: 0.2, width: 0.8, height: 0.5 },
              binding: { source: 'const', value: 'HI' },
            },
          ],
        },
      ],
    });
    const png = renderPng(planTemplate(template, {}));
    expect(png[0]).toBe(137);
    expect(png[1]).toBe(80);
    expect(png[2]).toBe(78);
    expect(png[3]).toBe(71);
    expect(png.byteLength).toBeGreaterThan(50);
  });
});

describe('coordinate round-trip', () => {
  it('fraction → pt → PDF y-flip closes', () => {
    const letter = { width: 612, height: 792 };
    for (let i = 0; i < 40; i++) {
      const x = (i * 17) % 100 / 100;
      const y = (i * 29) % 100 / 100;
      const p = rectToPoints(
        { x, y, width: 0.05, height: 0.04, rotation: 0, unit: 'fraction' },
        letter,
        150,
      );
      const pdf = toPdfRect(p, letter.height);
      expect(pdf.yBottom + p.height + p.y).toBeCloseTo(letter.height);
      expect(pdf.x).toBeCloseTo(p.x);
    }
  });
});
