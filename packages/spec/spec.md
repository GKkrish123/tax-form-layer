# Tax Form Annotation Specification — v1.0.0

A **medium-agnostic** data structure for annotating the fields/boxes of U.S. tax
forms, so that any application can pair the annotation with a taxpayer data set and
print correctly-formatted values into every box — on a PDF or a scanned image, at
any resolution.

- **Canonical schema:** Zod schemas in [`src/schema`](./src/schema) (the single
  source of truth).
- **TypeScript types:** derived from the schemas via `z.infer`.
- **JSON Schema:** generated to [`generated/annotation.schema.json`](./generated/annotation.schema.json)
  via `pnpm --filter @tax-form-layer/spec schema:gen`.
- **Worked example:** [`examples/w2-2024.annotation.json`](./examples/w2-2024.annotation.json).

---

## 1. Design goals

1. **Medium-agnostic** — the same annotation drives a vector PDF or a rasterized
   image without change. Achieved with **normalized `[0,1]` coordinates** and
   **point-based** font sizing (a form page is a fixed physical size regardless of
   medium).
2. **Deep data referencing** — a box declares *where its value lives* in an
   arbitrarily nested data set via **JSONPath** or **JSON Pointer**.
3. **Presentation-complete** — positioning, formatting, and styling are all
   expressible so a renderer needs no per-form custom code.
4. **Self-validating & versioned** — every document declares a `specVersion`;
   invalid documents are rejected with precise errors, and old documents are
   migrated forward.
5. **Decoupled** — the spec is a standalone package; the reference engine and editor
   consume it exactly the way a third party's "proprietary code" would.

---

## 2. Document model

```
FormTemplate
├─ specVersion        format version (drives migrations)
├─ id, title          identity of this annotation set
├─ templateVersion    content version of this annotation
├─ form               { jurisdiction, formNumber, taxYear, edition }
├─ medium             { kind: pdf|image, source?, dpi }
├─ pageSize           physical size in points (default US Letter 612×792)
├─ pages[]
│   ├─ number, size?, backgroundRef?
│   └─ fields[]       ← the annotations
├─ metadata?          author, description, tags, timestamps
└─ sampleData?        example data set (documentary / editor preview)
```

A **field** is a discriminated union on `type`:

| `type`     | Purpose                                             |
| ---------- | --------------------------------------------------- |
| `value`    | A single scalar drawn as text (the workhorse).      |
| `checkbox` | A mark drawn when a bound value is truthy.          |
| `comb`     | One character per cell (SSN/EIN/money comb boxes).  |
| `repeat`   | A group stamped once per element of a bound array.  |

Every field shares: `id`, optional `label`/`boxNumber`, a `rect`, optional `style`,
an optional render `condition`, and an optional author `note`.

---

## 3. Positioning

```jsonc
"rect": {
  "x": 0.50, "y": 0.06,        // top-left corner
  "width": 0.22, "height": 0.03,
  "rotation": 0,                // degrees clockwise, about the box center
  "unit": "fraction"            // "fraction" (default) | "pt" | "px"
}
```

- **Origin:** top-left, y increases downward (intuitive for editors/browsers). The
  engine flips to PDF's bottom-left origin at render time.
- **Units:**
  - `fraction` *(recommended)* — a fraction of page width (`x`,`width`) or height
    (`y`,`height`). Resolution-independent → the box lands in the same physical
    place on a PDF and on a 300-DPI scan.
  - `pt` — absolute points, when authoring against a known PDF.
  - `px` — absolute pixels, interpreted through the medium `dpi`.

---

## 4. Referencing a value from deeply nested data

The `binding` declares where a field's value comes from:

```jsonc
// JSONPath — most expressive (wildcards, indexing, filters)
{ "source": "jsonpath", "path": "$.income.w2[0].box1", "fallback": 0 }

// RFC 6901 JSON Pointer — dependency-light, unambiguous
{ "source": "pointer", "pointer": "/employee/ssn" }

// Constant — static text baked into the annotation
{ "source": "const", "value": "SEE STATEMENT" }

// Template — compose multiple refs into one string
{ "source": "template",
  "template": "{$.employee.firstName} {$.employee.lastName}" }
```

Optional on every binding:

- `fallback` — value used when the reference is missing/empty.
- `transforms` — an ordered pipeline (`trim`, `abs`, `negate`, `round`, `multiply`,
  `divide`, `slice`, `replace`, `coalesce`, casing) applied before formatting.

Inside a `repeat` group, child bindings use **`@` as the row root**, e.g.
`@.amount` resolves against the current array element.

---

## 5. Formatting

`format` is a discriminated union on `type`. Highlights tuned for tax forms:

| `type`     | Key options                                                              |
| ---------- | ------------------------------------------------------------------------ |
| `currency` | `locale`, `currency`, `decimals`, `symbol`, `grouping`, `negative` (`parentheses`\|`minus`\|`none`), `zeroAs` |
| `number`   | `decimals`, `grouping`, `negative`                                       |
| `percent`  | `decimals`, `scale` (ratio→percent)                                      |
| `date`     | `inputFormat?`, `outputFormat` (e.g. `MM/DD/YYYY`), `locale`             |
| `ssn`      | `mask` → `XXX-XX-1234`                                                   |
| `ein`      | `XX-XXXXXXX`                                                             |
| `phone`    | `(XXX) XXX-XXXX`                                                         |
| `text`     | `case` (`upper`/`lower`/`title`), `maxLength`                            |
| `boolean`  | `trueText`, `falseText`                                                  |
| `none`     | raw string                                                               |

Accounting-style negative parentheses `(1,234.00)` are first-class because the IRS
uses them widely.

---

## 6. Styling

```jsonc
"style": {
  "font": "Helvetica",          // one of the 14 standard PDF fonts
  "fontSize": 10,                // points (medium-agnostic)
  "minFontSize": 5,             // lower bound for shrink-to-fit
  "color": "#000000",
  "align": "right",             // left | center | right
  "verticalAlign": "middle",    // top | middle | bottom
  "overflow": "shrink",         // shrink | clip | ellipsis | wrap
  "letterSpacing": 0,
  "lineHeight": 1.15,
  "padding": { "top": 0, "right": 2, "bottom": 0, "left": 2 }
}
```

Omitted properties fall back to spec defaults, so minimal annotations stay terse.

---

## 7. Conditions

A field may declare a render `condition`; when false, the field is skipped:

```jsonc
"condition": { "path": "$.filingStatus", "operator": "eq", "value": "MFJ" }
```

Operators: `exists`, `notExists`, `truthy`, `falsy`, `eq`, `ne`, `gt`, `lt`, `gte`,
`lte`.

---

## 8. Repeating groups (tables)

```jsonc
{
  "type": "repeat",
  "id": "state_rows",
  "rect": { "x": 0.05, "y": 0.85, "width": 0.9, "height": 0.03 },
  "itemsPath": "$.state",   // array to iterate
  "rowHeight": 0.035,        // downward offset per row (group's unit)
  "maxRows": 2,
  "fields": [ /* child fields; rects relative to group, bindings use @ */ ]
}
```

---

## 9. Validation & versioning

- `parseTemplate(input)` returns a discriminated result `{ ok, template, migrated }`
  or `{ ok: false, errors[] }` with dotted paths — never throws.
- Unknown `specVersion` values are rejected; known-older ones are migrated forward
  through the ordered registry in [`src/migrations`](./src/migrations).
- Semantic versioning: **MAJOR** breaking (needs migration), **MINOR** additive,
  **PATCH** clarifying.

---

## 10. Consuming the spec (third-party integration)

```ts
import { parseTemplate } from '@tax-form-layer/spec';
import { planTemplate } from '@tax-form-layer/engine';
import { renderPdf } from '@tax-form-layer/engine/pdf';

const { ok, template } = parseTemplate(annotationJson);
if (!ok) throw new Error('invalid annotation');

const plan = planTemplate(template, taxpayerData); // resolve + format + position
const pdfBytes = await renderPdf(plan, { basePdf }); // draw into the boxes
```

`planTemplate` emits a fully-resolved, renderer-agnostic **RenderPlan** (every value
resolved and formatted, every coordinate in points). Any backend — the bundled PDF
renderer, an image compositor, or the browser preview — can consume it, which is the
seam that keeps the annotation format independent of drawing technology.
