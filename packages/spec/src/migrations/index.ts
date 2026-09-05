import { SPEC_VERSION } from '../version.js';

export interface Migration {
  from: string;
  to: string;
  migrate: (doc: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * When a breaking change ships, append a migration here, e.g.:
 *   { from: '1.0.0', to: '1.1.0', migrate: (doc) => ({ ...doc, specVersion: '1.1.0', ... }) }
 */
export const MIGRATIONS: readonly Migration[] = [];

export const KNOWN_SPEC_VERSIONS: readonly string[] = [
  SPEC_VERSION,
  ...MIGRATIONS.map((m) => m.from),
];

export function isKnownSpecVersion(version: string): boolean {
  return KNOWN_SPEC_VERSIONS.includes(version);
}

export function migrateToLatest(
  doc: Record<string, unknown>,
  fromVersion: string,
): Record<string, unknown> {
  let current = doc;
  let version = fromVersion;

  while (version !== SPEC_VERSION) {
    const step = MIGRATIONS.find((m) => m.from === version);
    if (!step) {
      throw new Error(`No migration path from spec version "${version}" to "${SPEC_VERSION}".`);
    }
    current = step.migrate(current);
    version = step.to;
  }
  return current;
}
