import { describe, it, expect } from 'vitest';
import { formatValue } from '../src/format/index.js';

describe('formatValue', () => {
  it('formats currency with grouping and 2 decimals', () => {
    expect(
      formatValue(84250.75, {
        type: 'currency',
        locale: 'en-US',
        currency: 'USD',
        decimals: 2,
        symbol: false,
        grouping: true,
        negative: 'parentheses',
      }),
    ).toBe('84,250.75');
  });

  it('wraps negative currency in parentheses', () => {
    expect(
      formatValue(-1234, {
        type: 'currency',
        locale: 'en-US',
        currency: 'USD',
        decimals: 2,
        symbol: false,
        grouping: true,
        negative: 'parentheses',
      }),
    ).toBe('(1,234.00)');
  });

  it('renders zeroAs override', () => {
    expect(
      formatValue(0, {
        type: 'currency',
        locale: 'en-US',
        currency: 'USD',
        decimals: 2,
        symbol: false,
        grouping: true,
        negative: 'parentheses',
        zeroAs: '-0-',
      }),
    ).toBe('-0-');
  });

  it('formats an SSN', () => {
    expect(formatValue('123456789', { type: 'ssn', mask: false })).toBe('123-45-6789');
  });

  it('masks an SSN', () => {
    expect(formatValue('123456789', { type: 'ssn', mask: true })).toBe('XXX-XX-6789');
  });

  it('formats an EIN', () => {
    expect(formatValue('981234567', { type: 'ein' })).toBe('98-1234567');
  });

  it('formats a phone number', () => {
    expect(formatValue('4155550123', { type: 'phone' })).toBe('(415) 555-0123');
  });

  it('uppercases text', () => {
    expect(formatValue('rivera', { type: 'text', case: 'upper' })).toBe('RIVERA');
  });

  it('formats a percent from a ratio when scaled', () => {
    expect(formatValue(0.25, { type: 'percent', locale: 'en-US', decimals: 0, scale: true })).toBe(
      '25%',
    );
  });

  it('formats a date with a token pattern', () => {
    expect(
      formatValue('2024-03-05', { type: 'date', outputFormat: 'MM/DD/YYYY', locale: 'en-US' }),
    ).toBe('03/05/2024');
  });

  it('renders booleans as configured text', () => {
    expect(formatValue(true, { type: 'boolean', trueText: 'X', falseText: '' })).toBe('X');
    expect(formatValue(false, { type: 'boolean', trueText: 'X', falseText: '' })).toBe('');
  });
});
