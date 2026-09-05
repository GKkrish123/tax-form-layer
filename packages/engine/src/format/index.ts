import type { FormatSpec, NegativeStyle } from '@tax-form-layer/spec';
import type { ResolvedValue } from '../resolve/binding.js';

function toNumber(value: ResolvedValue): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s]/g, '');
    if (cleaned !== '' && !Number.isNaN(Number(cleaned))) return Number(cleaned);
  }
  return undefined;
}

function applyNegative(formatted: string, isNegative: boolean, style: NegativeStyle): string {
  if (!isNegative) return formatted;
  const bare = formatted.replace(/^-/, '');
  switch (style) {
    case 'parentheses':
      return `(${bare})`;
    case 'none':
      return bare;
    case 'minus':
    default:
      return formatted.startsWith('-') ? formatted : `-${bare}`;
  }
}

function digitsOnly(value: ResolvedValue): string {
  return value === null || value === undefined ? '' : String(value).replace(/\D/g, '');
}

function titleCase(input: string): string {
  return input.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const DATE_TOKENS: Array<[RegExp, (d: Date, locale: string) => string]> = [
  [/YYYY/g, (d) => String(d.getFullYear()).padStart(4, '0')],
  [/YY/g, (d) => String(d.getFullYear()).slice(-2)],
  [/MMMM/g, (d, l) => d.toLocaleString(l, { month: 'long' })],
  [/MMM/g, (d, l) => d.toLocaleString(l, { month: 'short' })],
  [/MM/g, (d) => String(d.getMonth() + 1).padStart(2, '0')],
  [/DD/g, (d) => String(d.getDate()).padStart(2, '0')],
];

function formatDate(value: ResolvedValue, outputFormat: string, locale: string): string {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  // Replace longer tokens first to avoid partial collisions (handled by order above).
  let out = outputFormat;
  for (const [token, fn] of DATE_TOKENS) {
    out = out.replace(token, fn(date, locale));
  }
  return out;
}

export function formatValue(value: ResolvedValue, format: FormatSpec): string {
  switch (format.type) {
    case 'none':
      return value === null || value === undefined ? '' : String(value);

    case 'text': {
      let s = value === null || value === undefined ? '' : String(value);
      if (format.case === 'upper') s = s.toUpperCase();
      else if (format.case === 'lower') s = s.toLowerCase();
      else if (format.case === 'title') s = titleCase(s);
      if (format.maxLength !== undefined && s.length > format.maxLength) {
        s = s.slice(0, format.maxLength);
      }
      return s;
    }

    case 'currency': {
      const n = toNumber(value);
      if (n === undefined) return '';
      if (n === 0 && format.zeroAs !== undefined) return format.zeroAs;
      const abs = Math.abs(n);
      const nf = new Intl.NumberFormat(format.locale, {
        style: format.symbol ? 'currency' : 'decimal',
        currency: format.currency,
        minimumFractionDigits: format.decimals,
        maximumFractionDigits: format.decimals,
        useGrouping: format.grouping,
      });
      return applyNegative(nf.format(abs), n < 0, format.negative);
    }

    case 'number': {
      const n = toNumber(value);
      if (n === undefined) return '';
      const abs = Math.abs(n);
      const nf = new Intl.NumberFormat(format.locale, {
        minimumFractionDigits: format.decimals,
        maximumFractionDigits: format.decimals,
        useGrouping: format.grouping,
      });
      return applyNegative(nf.format(abs), n < 0, format.negative);
    }

    case 'percent': {
      const n = toNumber(value);
      if (n === undefined) return '';
      // Intl's percent style multiplies by 100. When `scale` is true the input is
      // a ratio (0.25 → 25%), so pass it through; otherwise the input is already a
      // percent number (25 → 25%), so divide by 100 first.
      const ratio = format.scale ? n : n / 100;
      const nf = new Intl.NumberFormat(format.locale, {
        style: 'percent',
        minimumFractionDigits: format.decimals,
        maximumFractionDigits: format.decimals,
      });
      return nf.format(ratio);
    }

    case 'date':
      return formatDate(value, format.outputFormat, format.locale);

    case 'ssn': {
      const d = digitsOnly(value).padStart(9, '').slice(0, 9);
      if (d.length !== 9) return String(value ?? '');
      const area = format.mask ? 'XXX' : d.slice(0, 3);
      const group = format.mask ? 'XX' : d.slice(3, 5);
      return `${area}-${group}-${d.slice(5)}`;
    }

    case 'ein': {
      const d = digitsOnly(value).slice(0, 9);
      if (d.length !== 9) return String(value ?? '');
      return `${d.slice(0, 2)}-${d.slice(2)}`;
    }

    case 'phone': {
      const d = digitsOnly(value).slice(-10);
      if (d.length !== 10) return String(value ?? '');
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }

    case 'boolean':
      return value ? format.trueText : format.falseText;

    default: {
      const _exhaustive: never = format;
      return _exhaustive;
    }
  }
}
