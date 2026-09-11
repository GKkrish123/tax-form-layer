# Tax Form Layer

Annotate tax form boxes once. Fill them from nested taxpayer data onto PDF or image, correctly formatted every time.

**Spec** defines the annotation contract. **Engine** resolves bindings, formats values, and renders. **Studio** is the visual editor for authoring templates.

## Quick start

```bash
corepack enable pnpm
pnpm install

pnpm --filter @tax-form-layer/spec schema:gen
pnpm --filter @tax-form-layer/web db:push
pnpm --filter @tax-form-layer/web forms:gen

pnpm dev   # http://localhost:3000/editor
```

## Studio walkthrough (W-2)

The editor opens on the W-2 example at `/editor`.

1. **Preview** — switch to Preview (or Split) to see IRS-formatted fills on the mock PDF. Hover a filled value for provenance: raw → transforms → formatted.
2. **Incomplete JSON** — use the fixture switcher (*Incomplete*). Coverage drops and compile issues (`TFL-BIND-002`, `TFL-CON-001`) badge the unbound/missing boxes. Click an issue to select its field.
3. **Overflow** — switch to *Overflow* (long names + extra state rows). The repeat group clips to `maxRows` and writes “See attached” onto the statement field (`TFL-OVR-003`).
4. **Provenance** — back on *Complete*, hover Box 1. Wages are a computed `sum` of `$.wages.base` and `$.wages.tips`, not a hand-typed string.
5. **PNG** — Download PNG uses the same `RenderPlan` as PDF (`/api/render?format=png`).

Copies B and C are one annotation, two plan pages. Undo, snap, layers, and ⌘K are available in Edit.

## Packages

| Package | Role |
| ------- | ---- |
| `@tax-form-layer/spec` | Annotation schema, validation, migrations |
| `@tax-form-layer/engine` | Bind → format → layout → PDF / PNG |
| `@tax-form-layer/web` | Annotation studio |

## Use the engine

```ts
import { parseTemplate } from '@tax-form-layer/spec';
import { compileTemplate } from '@tax-form-layer/engine';
import { renderPdf } from '@tax-form-layer/engine/pdf';
import { renderPng } from '@tax-form-layer/engine/png';

const parsed = parseTemplate(annotationJson);
if (!parsed.ok) throw new Error(parsed.errors[0]?.message);

const { plan, issues, coverage } = compileTemplate(parsed.template, taxpayerData);
const pdf = await renderPdf(plan, { basePdf });
const png = renderPng(plan);
```

Worked examples (open from **Forms → Examples** in the studio):

- [`w2-2024`](packages/spec/examples/w2-2024.annotation.json) — computed wages, copies, overflow fixtures
- [`w4-2024`](packages/spec/examples/w4-2024.annotation.json) — filing-status radios, spouse fields gated by MFJ
- [`w9-2024`](packages/spec/examples/w9-2024.annotation.json) — classification radios, SSN/EIN combs
- [`1099-nec-2024`](packages/spec/examples/1099-nec-2024.annotation.json), [`1099-int-2024`](packages/spec/examples/1099-int-2024.annotation.json), [`1099-misc-2024`](packages/spec/examples/1099-misc-2024.annotation.json)

## Docs

- [Specification](packages/spec/spec.md)
- [Design decisions](DECISIONS.md)
