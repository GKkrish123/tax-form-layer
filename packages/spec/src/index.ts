export { SPEC_VERSION, type SpecVersion } from './version.js';
export * from './schema/index.js';
export * from './validate.js';
export {
  type Migration,
  MIGRATIONS,
  KNOWN_SPEC_VERSIONS,
  isKnownSpecVersion,
  migrateToLatest,
} from './migrations/index.js';
