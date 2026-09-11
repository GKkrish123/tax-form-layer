import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTemplate, assertTemplate, SPEC_VERSION } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const w2 = JSON.parse(readFileSync(resolve(here, '../examples/w2-2024.annotation.json'), 'utf8'));

describe('parseTemplate', () => {
  it('accepts the reference W-2 annotation', () => {
    const result = parseTemplate(w2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.migrated).toBe(false);
      expect(result.template.id).toBe('irs-w2-2024');
      expect(result.template.pages[0]?.fields.length).toBeGreaterThan(5);
      expect(result.template.copies?.length).toBe(2);
    }
  });

  it('applies defaults (rotation, unit, style overflow)', () => {
    const tpl = assertTemplate(w2);
    const first = tpl.pages[0]?.fields[0];
    expect(first?.rect.rotation).toBe(0);
    expect(first?.rect.unit).toBe('fraction');
  });

  it('rejects an unknown field type', () => {
    const bad = structuredClone(w2);
    bad.pages[0].fields[0].type = 'wormhole';
    const result = parseTemplate(bad);
    expect(result.ok).toBe(false);
  });

  it('rejects a missing required binding path', () => {
    const bad = structuredClone(w2);
    delete bad.pages[0].fields[0].binding.path;
    const result = parseTemplate(bad);
    expect(result.ok).toBe(false);
  });

  it('rejects unknown spec versions', () => {
    const bad = { ...w2, specVersion: '99.0.0' };
    const result = parseTemplate(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.path).toBe('specVersion');
    }
  });

  it('migrates 1.0.0 documents to the current spec', () => {
    const v1 = { ...w2, specVersion: '1.0.0' };
    const result = parseTemplate(v1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.migrated).toBe(true);
      expect(result.template.specVersion).toBe(SPEC_VERSION);
    }
  });

  it('accepts a computed sum binding', () => {
    const doc = structuredClone(w2);
    doc.specVersion = SPEC_VERSION;
    doc.pages[0].fields[0].binding = {
      source: 'computed',
      op: 'sum',
      args: [
        { source: 'jsonpath', path: '$.boxes.box1' },
        { source: 'jsonpath', path: '$.boxes.box2' },
      ],
    };
    const result = parseTemplate(doc);
    expect(result.ok).toBe(true);
  });

  it('accepts a radio field', () => {
    const doc = structuredClone(w2);
    doc.specVersion = SPEC_VERSION;
    doc.pages[0].fields.push({
      type: 'radio',
      id: 'status_mfj',
      group: 'filingStatus',
      option: 'MFJ',
      rect: { x: 0.1, y: 0.4, width: 0.02, height: 0.02 },
      binding: { source: 'jsonpath', path: '$.filingStatus' },
    });
    const result = parseTemplate(doc);
    expect(result.ok).toBe(true);
  });

  it('accepts compound all/any/not conditions', () => {
    const doc = structuredClone(w2);
    doc.specVersion = SPEC_VERSION;
    doc.pages[0].fields[0].condition = {
      all: [
        { path: '$.filingStatus', operator: 'eq', value: 'MFJ' },
        { not: { path: '$.deceased', operator: 'truthy' } },
      ],
    };
    const result = parseTemplate(doc);
    expect(result.ok).toBe(true);
  });

  it('accepts copies and repeat overflow policy', () => {
    const doc = structuredClone(w2);
    doc.specVersion = SPEC_VERSION;
    doc.copies = [{ id: 'B', title: 'Copy B', pageFilter: [1] }];
    const repeat = doc.pages[0].fields.find((f: { type: string }) => f.type === 'repeat');
    repeat.overflow = { strategy: 'statement', statementText: 'See attached', statementFieldId: 'state_see_stmt' };
    const result = parseTemplate(doc);
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown computed op', () => {
    const doc = structuredClone(w2);
    doc.specVersion = SPEC_VERSION;
    doc.pages[0].fields[0].binding = { source: 'computed', op: 'eval', args: [] };
    const result = parseTemplate(doc);
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown overflow strategy', () => {
    const doc = structuredClone(w2);
    doc.specVersion = SPEC_VERSION;
    const repeat = doc.pages[0].fields.find((f: { type: string }) => f.type === 'repeat');
    repeat.overflow = { strategy: 'teleport' };
    const result = parseTemplate(doc);
    expect(result.ok).toBe(false);
  });

  it('accepts the compact 1099-NEC example', () => {
    const nec = JSON.parse(
      readFileSync(resolve(here, '../examples/1099-nec-2024.annotation.json'), 'utf8'),
    );
    const result = parseTemplate(nec);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.template.id).toBe('irs-1099-nec-2024');
  });

  it.each(['w4-2024', 'w9-2024', '1099-int-2024', '1099-misc-2024'])(
    'accepts the %s example',
    (slug) => {
      const doc = JSON.parse(
        readFileSync(resolve(here, `../examples/${slug}.annotation.json`), 'utf8'),
      );
      const result = parseTemplate(doc);
      expect(result.ok).toBe(true);
    },
  );
});
