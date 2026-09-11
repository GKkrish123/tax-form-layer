import type { Field } from '@tax-form-layer/spec';

const rect = (x: number, y: number, width: number, height: number) => ({
  x,
  y,
  width,
  height,
  rotation: 0,
  unit: 'fraction' as const,
});

export const FIELD_PRESETS: Array<{ id: string; label: string; create: () => Field }> = [
  {
    id: 'ssn-comb',
    label: 'SSN comb (9)',
    create: () => ({
      type: 'comb',
      id: `ssn_${Math.random().toString(36).slice(2, 7)}`,
      label: 'SSN',
      rect: rect(0.1, 0.1, 0.36, 0.03),
      binding: { source: 'jsonpath', path: '$.' },
      format: { type: 'ssn', mask: false },
      cells: 9,
      cellGap: 0.08,
      alignRight: false,
    }),
  },
  {
    id: 'ein-comb',
    label: 'EIN comb',
    create: () => ({
      type: 'comb',
      id: `ein_${Math.random().toString(36).slice(2, 7)}`,
      label: 'EIN',
      rect: rect(0.1, 0.15, 0.32, 0.03),
      binding: { source: 'jsonpath', path: '$.' },
      format: { type: 'ein' },
      cells: 10,
      cellGap: 0.08,
      alignRight: false,
    }),
  },
  {
    id: 'usd',
    label: 'USD parentheses',
    create: () => ({
      type: 'value',
      id: `usd_${Math.random().toString(36).slice(2, 7)}`,
      label: 'Amount',
      rect: rect(0.5, 0.1, 0.22, 0.03),
      binding: { source: 'jsonpath', path: '$.' },
      format: {
        type: 'currency',
        locale: 'en-US',
        currency: 'USD',
        decimals: 2,
        symbol: false,
        grouping: true,
        negative: 'parentheses',
      },
      style: { align: 'right', fontSize: 10, font: 'Helvetica', minFontSize: 5, color: '#000000', verticalAlign: 'middle', letterSpacing: 0, lineHeight: 1.15, overflow: 'shrink' },
    }),
  },
  {
    id: 'checkbox-x',
    label: 'Checkbox X',
    create: () => ({
      type: 'checkbox',
      id: `chk_${Math.random().toString(36).slice(2, 7)}`,
      label: 'Check',
      rect: rect(0.1, 0.2, 0.02, 0.02),
      binding: { source: 'jsonpath', path: '$.' },
      mark: 'text',
      markText: 'X',
    }),
  },
];
