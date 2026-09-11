import type { Binding, Field, FormTemplate, RepeatingGroup } from '@tax-form-layer/spec';
import { isUnboundPath, queryJsonPath } from '../resolve/query.js';

export interface CoverageReport {
  bound: string[];
  missing: string[];
  extra?: string[];
}

export function collectPaths(template: FormTemplate): string[] {
  const paths = new Set<string>();
  const walkBinding = (b: Binding) => {
    if (b.source === 'jsonpath' && !isUnboundPath(b.path)) paths.add(b.path);
    if (b.source === 'computed') {
      if (b.op === 'if') {
        walkBinding(b.then);
        walkBinding(b.else);
      } else {
        for (const arg of b.args) walkBinding(arg);
      }
    }
  };
  const walkField = (field: Field) => {
    if (field.type === 'repeat') {
      if (!isUnboundPath(field.itemsPath)) paths.add(field.itemsPath);
      for (const child of field.fields) walkField(child);
      return;
    }
    if ('binding' in field) walkBinding(field.binding);
  };
  for (const page of template.pages) {
    for (const field of page.fields) walkField(field);
  }
  return [...paths].sort();
}

export function coverage(template: FormTemplate, data: unknown): CoverageReport {
  const paths = collectPaths(template);
  const bound: string[] = [];
  const missing: string[] = [];
  for (const path of paths) {
    const value = queryJsonPath(path, { root: data });
    const empty = value === undefined || value === null || value === '';
    if (empty) missing.push(path);
    else bound.push(path);
  }

  const extra = extraFromSample(template, data);
  return extra ? { bound, missing, extra } : { bound, missing };
}

function extraFromSample(template: FormTemplate, data: unknown): string[] | undefined {
  if (template.sampleData === undefined || template.sampleData === data) return undefined;
  const samplePaths = flattenLeaves(template.sampleData, '$');
  const dataPaths = new Set(flattenLeaves(data, '$'));
  const extra = samplePaths.filter((p) => !dataPaths.has(p));
  return extra.length ? extra : [];
}

function flattenLeaves(value: unknown, prefix: string): string[] {
  if (value === null || value === undefined || typeof value !== 'object') return [prefix];
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => flattenLeaves(item, `${prefix}[${i}]`));
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    flattenLeaves(v, `${prefix}.${k}`),
  );
}

export function toDataJsonSchema(template: FormTemplate): Record<string, unknown> {
  const root: Record<string, unknown> = { type: 'object', properties: {} };
  for (const path of collectPaths(template)) {
    insertPath(root, path);
  }
  for (const page of template.pages) {
    for (const field of page.fields) {
      if (field.type === 'repeat') markArray(root, field);
    }
  }
  return { $schema: 'https://json-schema.org/draft/2020-12/schema', ...root };
}

function markArray(root: Record<string, unknown>, group: RepeatingGroup) {
  const path = group.itemsPath;
  if (!path.startsWith('$.')) return;
  const segs = path.slice(2).split('.');
  let node: Record<string, unknown> = root;
  for (let i = 0; i < segs.length; i++) {
    const props = (node.properties ?? {}) as Record<string, Record<string, unknown>>;
    node.properties = props;
    const key = segs[i]!;
    props[key] ??= { type: 'object', properties: {} };
    if (i === segs.length - 1) {
      props[key] = { type: 'array', items: props[key].items ?? { type: 'object', properties: {} } };
    }
    node = (props[key].items as Record<string, unknown>) ?? props[key];
  }
}

function insertPath(root: Record<string, unknown>, path: string) {
  const normalized = path.replace(/\[(\d+)\]/g, '.$1').replace(/^\$\.?/, '');
  if (!normalized) return;
  const segs = normalized.split('.').filter(Boolean);
  let node: Record<string, unknown> = root;
  for (let i = 0; i < segs.length; i++) {
    const props = (node.properties ?? {}) as Record<string, Record<string, unknown>>;
    node.properties = props;
    const key = segs[i]!;
    const isIndex = /^\d+$/.test(key);
    if (isIndex) {
      node.type = 'array';
      node.items ??= { type: 'object', properties: {} };
      node = node.items as Record<string, unknown>;
      continue;
    }
    props[key] ??= i === segs.length - 1 ? { type: 'string' } : { type: 'object', properties: {} };
    node = props[key];
  }
}
