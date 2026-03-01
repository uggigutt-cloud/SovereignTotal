// rules/pack-composer.ts
// Utilities for combining and filtering rule packs.
//
// Both functions are pure — they do not mutate the input packs and require
// no DB access. Useful for building jurisdiction-specific or tier-scoped
// sub-packs from the base sovereign-core-rulepack.

import type { Rule, RulePack } from "./sovereign-rulepack-api";

export interface ComposeOptions {
  /** ID for the resulting pack. Defaults to "composed". */
  id?: string;
  /** Version string for the resulting pack. Defaults to "0.0.0". */
  version?: string;
  /** Rule IDs to exclude from the merged result. */
  excludeRuleIds?: string[];
}

/**
 * Merge rules from multiple packs into a single RulePack.
 * Deduplication: if the same rule ID appears in more than one pack,
 * the first occurrence (lowest index) wins.
 * Rules listed in `opts.excludeRuleIds` are omitted from the result.
 */
export function composePacks(packs: RulePack[], opts: ComposeOptions = {}): RulePack {
  const seen = new Set<string>();
  const rules: Rule[] = [];
  const exclude = new Set(opts.excludeRuleIds ?? []);

  for (const pack of packs) {
    for (const rule of pack.rules) {
      if (seen.has(rule.id) || exclude.has(rule.id)) continue;
      seen.add(rule.id);
      rules.push(rule);
    }
  }

  return {
    id: opts.id ?? "composed",
    version: opts.version ?? "0.0.0",
    rules
  };
}

export interface FilterOptions {
  /**
   * If provided, only rules whose `kind` matches one of these values are kept.
   * Rules with no `kind` set are kept only when no `kinds` filter is specified.
   */
  kinds?: string[];
  /** Rule IDs to remove regardless of kind. */
  excludeIds?: string[];
}

/**
 * Return a new RulePack that contains only the rules matching the filter.
 * The original pack is not mutated.
 */
export function filterPack(pack: RulePack, opts: FilterOptions): RulePack {
  const exclude = new Set(opts.excludeIds ?? []);
  const kindsFilter = opts.kinds && opts.kinds.length > 0 ? new Set(opts.kinds) : null;

  const rules = pack.rules.filter(rule => {
    if (exclude.has(rule.id)) return false;
    if (kindsFilter) {
      return typeof rule.kind === "string" && kindsFilter.has(rule.kind);
    }
    return true;
  });

  return { id: pack.id, version: pack.version, rules };
}
