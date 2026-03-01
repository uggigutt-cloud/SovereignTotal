// engine/ewi-scorer.ts
// Dynamic EWI (Evidence Weight Index) computation for CLAIM nodes.
//
// EWI reflects how much evidential weight a claim carries, taking into account:
//   - eclass: evidence classification (E1=direct, E2=indirect, E3=reported, E4=hypothesis)
//   - supportCount: number of EXCERPT nodes that ASSERT or SUPPORT this claim
//   - contradictionScore: degree to which the claim is contradicted [0, 1]
//
// The attribute-normalizer calls computeClaimEwi() when normalizing CLAIM nodes
// instead of using the static type-based baseline of 0.45.

/**
 * Evidence class weights.
 * E1 — direct/primary evidence (highest weight)
 * E2 — indirect evidence
 * E3 — reported/secondary evidence
 * E4 — hearsay, hypothesis, or speculation (lowest weight)
 */
export const ECLASS_WEIGHT: Record<string, number> = {
  E1: 1.00,
  E2: 0.75,
  E3: 0.55,
  E4: 0.30
};

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/**
 * Compute the EWI for a CLAIM node.
 *
 * Formula:
 *   base         = ECLASS_WEIGHT[eclass] ?? 0.55   (fallback = E3 weight)
 *   supportBoost = min(supportCount * 0.05, 0.20)  (capped at +0.20)
 *   contradPen   = contradictionScore * 0.30
 *   result       = clamp(base + supportBoost - contradPen, 0, 1)
 *
 * @param eclass            Evidence classification string (e.g. "E1", "E3"). Null → fallback 0.55.
 * @param supportCount      Number of EXCERPT nodes with ASSERTS/SUPPORTS edges to this claim.
 * @param contradictionScore  Current contradiction score [0, 1].
 */
export function computeClaimEwi(
  eclass: string | null,
  supportCount: number,
  contradictionScore: number
): number {
  const base = eclass != null ? (ECLASS_WEIGHT[eclass] ?? 0.55) : 0.55;
  const supportBoost = Math.min(Math.max(0, supportCount) * 0.05, 0.20);
  const contradPen = clamp01(contradictionScore) * 0.30;
  return clamp01(base + supportBoost - contradPen);
}
