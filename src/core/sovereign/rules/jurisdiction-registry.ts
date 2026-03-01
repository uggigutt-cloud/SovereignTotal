// rules/jurisdiction-registry.ts
// Maps ISO 3166-1 alpha-2 jurisdiction codes to remedy catalogs.
// Pure functions — no DB access.

import type { DefectCategory, TierCode } from "./sovereign-rulepack-api";
import type { RemedyEntry } from "./remedy-catalog";
import { ALL_REMEDY_CATALOGS } from "./remedy-catalog";

export interface JurisdictionRegistry {
  readonly jurisdiction: string;
  readonly catalog: RemedyEntry[];
}

/** Built-in registries keyed by ISO 3166-1 alpha-2 code. */
export const JURISDICTION_REGISTRIES: Record<string, JurisdictionRegistry> = {
  NO: { jurisdiction: "NO", catalog: ALL_REMEDY_CATALOGS["NO"]! },
  SE: { jurisdiction: "SE", catalog: ALL_REMEDY_CATALOGS["SE"]! }
};

/**
 * Look up a registry by jurisdiction code.
 * Falls back to "NO" (Norwegian) if the jurisdiction is unknown.
 */
export function getJurisdictionRegistry(jurisdiction: string): JurisdictionRegistry {
  return JURISDICTION_REGISTRIES[jurisdiction] ?? JURISDICTION_REGISTRIES["NO"]!;
}

/**
 * Return all catalog entries that apply to the given defect category and tier.
 * Pure function — no side effects.
 */
export function getRemediesForDefect(
  registry: JurisdictionRegistry,
  category: DefectCategory,
  tier: TierCode
): RemedyEntry[] {
  return registry.catalog.filter(
    entry =>
      entry.applicableCategories.includes(category) &&
      entry.applicableTiers.includes(tier)
  );
}
