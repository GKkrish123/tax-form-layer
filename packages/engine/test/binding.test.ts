import { describe, it, expect } from 'vitest';
import { resolveBinding } from '../src/resolve/binding.js';

const data = {
  employee: { firstName: 'Jordan', lastName: 'Rivera', ssn: '123456789' },
  income: { w2: [{ box1: 84250.75 }, { box1: 1200 }] },
  flags: { joint: true },
};

describe('resolveBinding', () => {
  it('resolves a deep JSONPath', () => {
    expect(
      resolveBinding({ source: 'jsonpath', path: '$.income.w2[0].box1' }, { root: data }),
    ).toBe(84250.75);
  });

  it('resolves a JSON Pointer', () => {
    expect(resolveBinding({ source: 'pointer', pointer: '/employee/ssn' }, { root: data })).toBe(
      '123456789',
    );
  });

  it('applies fallback when missing', () => {
    expect(
      resolveBinding(
        { source: 'jsonpath', path: '$.income.w2[9].box1', fallback: 0 },
        { root: data },
      ),
    ).toBe(0);
  });

  it('interpolates a template binding', () => {
    expect(
      resolveBinding(
        { source: 'template', template: '{$.employee.firstName} {$.employee.lastName}' },
        { root: data },
      ),
    ).toBe('Jordan Rivera');
  });

  it('returns a constant', () => {
    expect(resolveBinding({ source: 'const', value: 'X' }, { root: data })).toBe('X');
  });

  it('applies a transform pipeline', () => {
    expect(
      resolveBinding(
        {
          source: 'jsonpath',
          path: '$.income.w2[0].box1',
          transforms: [{ op: 'negate' }, { op: 'round', decimals: 0 }],
        },
        { root: data },
      ),
    ).toBe(-84251);
  });

  it('resolves @-rooted paths against the row context', () => {
    expect(
      resolveBinding(
        { source: 'jsonpath', path: '@.box1' },
        { root: data, row: data.income.w2[1] },
      ),
    ).toBe(1200);
  });
});
