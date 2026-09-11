import { JSONPath } from 'jsonpath-plus';

/** `@`-rooted paths resolve against `row` when inside a repeating group. */
export interface ResolveContext {
  root: unknown;
  row?: unknown;
}

export function queryJsonPath(expression: string, ctx: ResolveContext): unknown {
  const usesRow = expression.startsWith('@');
  const json = usesRow ? ctx.row : ctx.root;
  const path = usesRow ? '$' + expression.slice(1) : expression;
  if (json === undefined || json === null) return undefined;
  return JSONPath({ path, json: json as object, wrap: false });
}

export function queryPointer(pointer: string, json: unknown): unknown {
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

export function isUnboundPath(path: string): boolean {
  return path === '$' || path === '$.' || path === '@' || path === '@.';
}
