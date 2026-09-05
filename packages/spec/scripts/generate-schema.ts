import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { FormTemplate } from '../src/schema/template.js';
import { SPEC_VERSION } from '../src/version.js';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '../generated/annotation.schema.json');

const jsonSchema = zodToJsonSchema(FormTemplate, {
  name: 'FormTemplate',
  $refStrategy: 'root',
  target: 'jsonSchema7',
});

const withMeta = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: `https://tax-form-layer.dev/schema/${SPEC_VERSION}/annotation.schema.json`,
  title: `Tax Form Annotation Spec v${SPEC_VERSION}`,
  ...jsonSchema,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(withMeta, null, 2) + '\n', 'utf8');

console.log(`Wrote JSON Schema (spec v${SPEC_VERSION}) → ${outPath}`);
