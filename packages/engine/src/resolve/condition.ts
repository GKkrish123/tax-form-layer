import type { Condition } from '@tax-form-layer/spec';
import { queryJsonPath, type ResolveContext } from './binding.js';

export function evaluateCondition(condition: Condition, ctx: ResolveContext): boolean {
  const actual = queryJsonPath(condition.path, ctx) as unknown;

  switch (condition.operator) {
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'notExists':
      return actual === undefined || actual === null;
    case 'truthy':
      return Boolean(actual);
    case 'falsy':
      return !actual;
    case 'eq':
      return actual === condition.value;
    case 'ne':
      return actual !== condition.value;
    case 'gt':
      return Number(actual) > Number(condition.value);
    case 'lt':
      return Number(actual) < Number(condition.value);
    case 'gte':
      return Number(actual) >= Number(condition.value);
    case 'lte':
      return Number(actual) <= Number(condition.value);
    default: {
      const _exhaustive: never = condition.operator;
      return _exhaustive;
    }
  }
}
