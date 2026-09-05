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

## Packages

| Package | Role |
| ------- | ---- |
| `@tax-form-layer/spec` | Annotation schema, validation, migrations |
| `@tax-form-layer/engine` | Bind → format → layout → PDF |
| `@tax-form-layer/web` | Annotation studio |

## Use the engine

```ts
import { parseTemplate } from '@tax-form-layer/spec';
import { planTemplate } from '@tax-form-layer/engine';
import { renderPdf } from '@tax-form-layer/engine/pdf';

const parsed = parseTemplate(annotationJson);
if (!parsed.ok) throw new Error(parsed.errors[0]?.message);

const plan = planTemplate(parsed.template, taxpayerData);
const pdf = await renderPdf(plan, { basePdf });
```

## Docs

- [Specification](packages/spec/spec.md)
