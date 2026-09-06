import type { Field, FormatSpec } from '@tax-form-layer/spec';
import { guessAlign, guessFormat, suggestBindings } from './heuristics';

function isEmptyPath(path: string | undefined): boolean {
  if (!path) return true;
  const t = path.trim();
  return t === '' || t === '$' || t === '$.';
}

function formatFromGuess(type: ReturnType<typeof guessFormat>): FormatSpec {
  switch (type) {
    case 'currency':
      return {
        type: 'currency',
        locale: 'en-US',
        currency: 'USD',
        decimals: 2,
        symbol: false,
        grouping: true,
        negative: 'parentheses',
      };
    case 'date':
      return { type: 'date', outputFormat: 'MM/DD/YYYY', locale: 'en-US' };
    case 'ssn':
      return { type: 'ssn', mask: false };
    case 'ein':
      return { type: 'ein' };
    case 'phone':
      return { type: 'phone' };
    case 'percent':
      return { type: 'percent', locale: 'en-US', decimals: 2, scale: false };
    case 'text':
      return { type: 'text', case: 'none' };
    case 'none':
      return { type: 'none' };
  }
}

/** Attach best heuristic binding + format/align guesses onto fields that are still empty. */
export function enrichFieldsHeuristically(fields: Field[], data: unknown): Field[] {
  return fields.map((field) => {
    if (field.type === 'repeat' || !('binding' in field)) return field;

    const label = field.label ?? '';
    const hint = `${label} ${field.boxNumber ?? ''}`;
    const patch: Record<string, unknown> = {};

    if (field.binding.source === 'jsonpath' && isEmptyPath(field.binding.path)) {
      const [best] = suggestBindings(label, field.boxNumber, data, 1);
      if (best) {
        patch.binding = { ...field.binding, path: best.path };
      }
    }

    if ('format' in field && field.format.type === 'none') {
      const guessed = guessFormat(hint);
      if (guessed !== 'none') {
        patch.format = formatFromGuess(guessed);
      }
    }

    const align = guessAlign(hint);
    if (!field.style?.align && align !== 'left') {
      patch.style = { ...(field.style ?? {}), align };
    }

    if (Object.keys(patch).length === 0) return field;
    return { ...field, ...patch } as Field;
  });
}

export function countEnrichableFields(fields: Field[]): number {
  return fields.filter((field) => {
    if (field.type === 'repeat' || !('binding' in field)) return false;
    return field.binding.source === 'jsonpath' && isEmptyPath(field.binding.path);
  }).length;
}
