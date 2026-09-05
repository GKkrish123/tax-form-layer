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
      expect(result.template.id).toBe('irs-w2-2024');
      expect(result.template.pages[0]?.fields.length).toBeGreaterThan(5);
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

  it('current SPEC_VERSION round-trips without migration', () => {
    const result = parseTemplate(w2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.migrated).toBe(false);
      expect(result.template.specVersion).toBe(SPEC_VERSION);
    }
  });
});
