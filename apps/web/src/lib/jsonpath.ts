import { resolveBinding } from '@tax-form-layer/engine';
import type { Binding } from '@tax-form-layer/spec';

export interface DataNode {
  key: string;
  path: string;
  kind: 'object' | 'array' | 'leaf';
  value: unknown;
  children?: DataNode[];
}

function childPath(parent: string, key: string, isIndex: boolean): string {
  return isIndex ? `${parent}[${key}]` : `${parent}.${key}`;
}

export function buildDataTree(value: unknown, path = '$', key = '$'): DataNode {
  if (Array.isArray(value)) {
    return {
      key,
      path,
      kind: 'array',
      value,
      children: value.map((v, i) => buildDataTree(v, childPath(path, String(i), true), `[${i}]`)),
    };
  }
  if (value !== null && typeof value === 'object') {
    return {
      key,
      path,
      kind: 'object',
      value,
      children: Object.entries(value as Record<string, unknown>).map(([k, v]) =>
        buildDataTree(v, childPath(path, k, false), k),
      ),
    };
  }
  return { key, path, kind: 'leaf', value };
}

export function previewPath(path: string, data: unknown): unknown {
  if (!path.trim()) return undefined;
  const binding: Binding = { source: 'jsonpath', path };
  return resolveBinding(binding, { root: data });
}
