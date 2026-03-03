/**
 * norwegian-report.ts
 * Maps Sovereign engine defect categories, tiers, and severities to
 * Norwegian legal language with Forvaltningsloven citations.
 */

export const DEFECT_CATEGORY_NB: Record<string, string> = {
  HOMELESMANGEL: "Hjemmelsmangel (manglende rettslig grunnlag)",
  KOMPETANSEMANGEL: "Kompetansemangel (Fvl. § 6)",
  UTREDNINGSPLIKTBRUDD: "Brudd på utredningsplikt (Fvl. § 17)",
  KONTRADIKSJONSPARTSRETT: "Brudd på kontradiksjonsprinsippet (Fvl. §§ 16–17)",
  BEGRUNNELSESMANGEL: "Begrunnelsesmangel (Fvl. § 25)",
  FEIL_FAKTUM_INNHOLD: "Feil faktum/innhold i vedtaket",
  DATAINTEGRITET_TAUSHET: "Brudd på taushetsplikt eller dataintegritet",
  EMK_PROSESS: "Prosessuelt brudd på EMK",
};

export const DEFECT_TIER_NB: Record<string, string> = {
  T1: "Primær feil (T1) — ugyldiggjør direkte",
  T2: "Sekundær feil (T2) — kan kureres",
  T3: "Tertiær feil (T3) — avhengig av T1/T2",
  T4: "Marginal feil (T4) — begrenset virkning",
};

export const FINDING_SEVERITY_NB: Record<string, string> = {
  CRITICAL: "Kritisk",
  HIGH: "Alvorlig",
  MED: "Moderat",
  LOW: "Lav",
  INFO: "Informasjon",
};

export const STAGE_NB: Record<string, string> = {
  A: "Stage A – Undersøkelse",
  B: "Stage B – Hjelpetiltak",
  C: "Stage C – Akuttvedtak",
  D: "Stage D – Fylkesnemnd",
  E: "Stage E – Tingrett",
  F: "Stage F – Lagmannsrett",
  G: "Stage G – Høyesterett",
};

export const NODE_TYPE_NB: Record<string, string> = {
  DOCUMENT: "Dokument",
  EXCERPT: "Utdrag",
  CLAIM: "Påstand",
  DECISION: "Vedtak",
  RULE: "Lovhjemmel",
  DEFECT: "Feil",
  REMEDY: "Rettsmiddel",
  COUNTER: "Innsigelse",
};

export function defectCategoryNb(category: string): string {
  return DEFECT_CATEGORY_NB[category] ?? category;
}

export function defectTierNb(tier: string): string {
  return DEFECT_TIER_NB[tier] ?? tier;
}

export function findingSeverityNb(severity: string): string {
  return FINDING_SEVERITY_NB[severity] ?? severity;
}

export function stageNb(stage: string): string {
  return STAGE_NB[stage] ?? `Stage ${stage}`;
}

export function nodeTypeNb(type: string): string {
  return NODE_TYPE_NB[type] ?? type;
}
