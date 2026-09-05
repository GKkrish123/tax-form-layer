/**
 * The version of the *annotation specification format* itself (not the version of
 * any particular form template). Consumers use this to select the correct parser
 * and to drive migrations between format revisions.
 *
 * Semantic versioning:
 *  - MAJOR: breaking structural changes that require a migration.
 *  - MINOR: backwards-compatible additions (new optional fields, new enum members).
 *  - PATCH: clarifications with no structural impact.
 */
export const SPEC_VERSION = '1.0.0' as const;

export type SpecVersion = typeof SPEC_VERSION;
