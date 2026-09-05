export interface Leaf {
  path: string;
  value: unknown;
}

export function flattenLeaves(data: unknown, base = '$'): Leaf[] {
  if (Array.isArray(data)) {
    if (data.length === 0) return [{ path: base, value: data }];
    return data.flatMap((v, i) => flattenLeaves(v, `${base}[${i}]`));
  }
  if (data !== null && typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return [{ path: base, value: data }];
    return entries.flatMap(([k, v]) => flattenLeaves(v, `${base}.${k}`));
  }
  return [{ path: base, value: data }];
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 1);
}

export interface BindingSuggestion {
  path: string;
  score: number;
  valuePreview: string;
}

export function suggestBindings(
  label: string,
  boxNumber: string | undefined,
  data: unknown,
  limit = 5,
): BindingSuggestion[] {
  const leaves = flattenLeaves(data);
  const labelTokens = new Set(tokenize(label ?? ''));
  const box = (boxNumber ?? '').toLowerCase().trim();

  const scored = leaves.map((leaf) => {
    const segs = leaf.path.replace(/^\$\.?/, '').replace(/\[(\d+)\]/g, '.$1');
    const pathTokens = tokenize(segs);
    let score = 0;
    for (const t of pathTokens) {
      if (labelTokens.has(t)) score += 3;
      else if ([...labelTokens].some((lt) => lt.includes(t) || t.includes(lt))) score += 1;
    }
    const lastSeg = pathTokens[pathTokens.length - 1] ?? '';
    if (labelTokens.has(lastSeg)) score += 2;
    if (box && (lastSeg === `box${box}` || lastSeg === box)) score += 4;

    const preview = JSON.stringify(leaf.value);
    return {
      path: leaf.path,
      score,
      valuePreview: preview.length > 40 ? preview.slice(0, 40) + '…' : preview,
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export type NaiveFormatType =
  | 'currency'
  | 'date'
  | 'ssn'
  | 'ein'
  | 'phone'
  | 'percent'
  | 'text'
  | 'none';

export function guessFormat(text: string): NaiveFormatType {
  const t = text.toLowerCase();
  if (/\b(wage|amount|dollar|currency|pay|tax|withheld|income|\$)\b/.test(t)) return 'currency';
  if (/\bssn|social security\b/.test(t)) return 'ssn';
  if (/\bein|employer id\b/.test(t)) return 'ein';
  if (/\bphone|telephone\b/.test(t)) return 'phone';
  if (/\bdate|year|day\b/.test(t)) return 'date';
  if (/\bpercent|rate|%\b/.test(t)) return 'percent';
  if (/\bname|address|city|state|zip|text\b/.test(t)) return 'text';
  return 'none';
}

export function guessAlign(text: string): 'left' | 'center' | 'right' {
  const t = text.toLowerCase();
  if (/\bright\b/.test(t)) return 'right';
  if (/\bcenter|centre\b/.test(t)) return 'center';
  if (guessFormat(t) === 'currency' || guessFormat(t) === 'percent') return 'right';
  return 'left';
}
