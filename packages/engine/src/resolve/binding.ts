import type { Binding, Transform } from '@tax-form-layer/spec';
import { queryJsonPath, queryPointer, type ResolveContext } from './query.js';
import { evaluateCondition } from './condition.js';

export type ResolvedValue = string | number | boolean | null | undefined;
export type { ResolveContext };

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

export interface ResolveResult {
  value: ResolvedValue;
  typeMismatch?: string;
}

function applyPipeline(binding: Binding, raw: ResolvedValue): ResolvedValue {
  const isEmpty = raw === undefined || raw === null || (binding.source !== 'template' && raw === '');
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

function resolveComputed(binding: Binding & { source: 'computed' }, ctx: ResolveContext): ResolveResult {
  if (binding.op === 'if') {
    const pass = evaluateCondition(binding.condition, ctx);
    const branch = resolveBindingDetailed(pass ? binding.then : binding.else, ctx);
    return { value: applyPipeline(binding, branch.value), typeMismatch: branch.typeMismatch };
  }

  const nums: number[] = [];
  let mismatch: string | undefined;
  for (const arg of binding.args) {
    const part = resolveBindingDetailed(arg, ctx);
    const n = toNumber(part.value);
    if (n === undefined) {
      mismatch = `Computed ${binding.op} expected a number, got ${JSON.stringify(part.value)}`;
      nums.push(0);
    } else {
      nums.push(n);
    }
  }

  let value: number;
  switch (binding.op) {
    case 'sum':
      value = nums.reduce((a, b) => a + b, 0);
      break;
    case 'add':
      value = (nums[0] ?? 0) + (nums[1] ?? 0);
      break;
    case 'sub':
      value = (nums[0] ?? 0) - (nums[1] ?? 0);
      break;
    case 'mul':
      value = nums.reduce((a, b) => a * b, 1);
      break;
    case 'div':
      value = nums[1] ? (nums[0] ?? 0) / nums[1] : nums[0] ?? 0;
      break;
  }

  return { value: applyPipeline(binding, value), typeMismatch: mismatch };
}

export function resolveBindingDetailed(binding: Binding, ctx: ResolveContext): ResolveResult {
  if (binding.source === 'computed') {
    return resolveComputed(binding, ctx);
  }

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

  return { value: applyPipeline(binding, raw) };
}

export function resolveBinding(binding: Binding, ctx: ResolveContext): ResolvedValue {
  return resolveBindingDetailed(binding, ctx).value;
}

export { queryJsonPath };
