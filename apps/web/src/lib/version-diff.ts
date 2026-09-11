import type { Field, FormTemplate } from '@tax-form-layer/spec';

export interface FieldChange {
  id: string;
  kind: 'added' | 'removed' | 'changed';
  detail?: string;
}

function indexFields(t: FormTemplate): Map<string, Field> {
  const map = new Map<string, Field>();
  for (const page of t.pages) {
    for (const f of page.fields) map.set(f.id, f);
  }
  return map;
}

function summarize(field: Field): string {
  const bits: string[] = [field.type];
  if ('binding' in field) {
    const b = field.binding;
    if (b.source === 'jsonpath') bits.push(b.path);
    else if (b.source === 'computed') bits.push(`computed:${b.op}`);
    else bits.push(b.source);
  }
  if (field.type === 'repeat') bits.push(field.itemsPath);
  bits.push(`${field.rect.x.toFixed(3)},${field.rect.y.toFixed(3)}`);
  return bits.join(' · ');
}

export function diffTemplates(from: FormTemplate, to: FormTemplate): FieldChange[] {
  const a = indexFields(from);
  const b = indexFields(to);
  const changes: FieldChange[] = [];
  for (const [id, field] of b) {
    const prev = a.get(id);
    if (!prev) {
      changes.push({ id, kind: 'added', detail: summarize(field) });
      continue;
    }
    const sa = summarize(prev);
    const sb = summarize(field);
    if (sa !== sb) changes.push({ id, kind: 'changed', detail: `${sa} → ${sb}` });
  }
  for (const [id, field] of a) {
    if (!b.has(id)) changes.push({ id, kind: 'removed', detail: summarize(field) });
  }
  return changes;
}
