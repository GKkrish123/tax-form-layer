import { JSONPath } from 'jsonpath-plus';
import type { Binding, Transform } from '@tax-form-layer/spec';

export type ResolvedValue = string | number | boolean | null | undefined;

/** `@`-rooted paths resolve against `row` when inside a repeating group. */
export interface ResolveContext {
  root: unknown;
  row?: unknown;
}

function queryJsonPath(expression: string, ctx: ResolveContext): unknown {
  const usesRow = expression.startsWith('@');
  const json = usesRow ? ctx.row : ctx.root;
  const path = usesRow ? '$' + expression.slice(1) : expression;
  if (json === undefined || json === null) return undefined;
  const matches = JSONPath({ path, json: json as object, wrap: false });
  // `wrap: false` returns a scalar for single matches, or an array for many.
  return matches;
}

function queryPointer(pointer: string, json: unknown): unknown {
  if (pointer === '' || pointer === '/') return json;
  const parts = pointer
    .split('/')
    .slice(1)
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let current: unknown = json;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      current = current[Number(part)];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

const TEMPLATE_TOKEN = /\{([^}]+)\}/g;

function resolveTemplate(template: string, ctx: ResolveContext): string {
  return template.replace(TEMPLATE_TOKEN, (_match, expr: string) => {
    const value = queryJsonPath(expr.trim(), ctx);
    return value === undefined || value === null ? '' : String(value);
  });
}

function toNumber(value: ResolvedValue): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function applyTransform(value: ResolvedValue, t: Transform): ResolvedValue {
  switch (t.op) {
    case 'trim':
      return typeof value === 'string' ? value.trim() : value;
    case 'uppercase':
      return typeof value === 'string' ? value.toUpperCase() : value;
    case 'lowercase':
      return typeof value === 'string' ? value.toLowerCase() : value;
    case 'abs': {
      const n = toNumber(value);
      return n === undefined ? value : Math.abs(n);
    }
    case 'negate': {
      const n = toNumber(value);
      return n === undefined ? value : -n;
    }
    case 'round': {
      const n = toNumber(value);
      if (n === undefined) return value;
      const f = 10 ** t.decimals;
      return Math.round(n * f) / f;
    }
    case 'multiply': {
      const n = toNumber(value);
      return n === undefined ? value : n * t.by;
    }
    case 'divide': {
      const n = toNumber(value);
      return n === undefined || t.by === 0 ? value : n / t.by;
    }
    case 'slice':
      return typeof value === 'string' ? value.slice(t.start, t.end) : value;
    case 'replace': {
      if (typeof value !== 'string') return value;
      if (t.regex) return value.replace(new RegExp(t.pattern, 'g'), t.replacement);
      return value.split(t.pattern).join(t.replacement);
    }
    case 'coalesce':
      return value === undefined || value === null || value === '' ? t.value : value;
    default: {
      const _exhaustive: never = t;
      return _exhaustive;
    }
  }
}

function coerceScalar(value: unknown): ResolvedValue {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => (v === null || v === undefined ? '' : String(v))).join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return value as ResolvedValue;
}

export function resolveBinding(binding: Binding, ctx: ResolveContext): ResolvedValue {
  let raw: ResolvedValue;

  switch (binding.source) {
    case 'jsonpath':
      raw = coerceScalar(queryJsonPath(binding.path, ctx));
      break;
    case 'pointer':
      raw = coerceScalar(queryPointer(binding.pointer, ctx.root));
      break;
    case 'const':
      raw = binding.value;
      break;
    case 'template':
      raw = resolveTemplate(binding.template, ctx);
      break;
  }

  const isEmpty =
    raw === undefined || raw === null || (binding.source !== 'template' && raw === '');
  if (isEmpty && binding.fallback !== undefined) {
    raw = binding.fallback;
  }

  if (binding.transforms) {
    for (const t of binding.transforms) {
      raw = applyTransform(raw, t);
    }
  }

  return raw;
}

export { queryJsonPath };
