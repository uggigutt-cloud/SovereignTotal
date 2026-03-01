// rules/remedy-catalog.ts
// Static registry of Norwegian administrative-law remedies.
// Each entry declares which defect categories and tiers it applies to.
// The remedy-linker uses this to populate remedies + defect_remedies at runtime.

import type { DefectCategory, TierCode } from "./sovereign-rulepack-api";

export interface RemedyEntry {
  remedyId: string;
  name: string;
  description: string;
  jurisdiction: string;
  typicalDeadline: string;
  applicableCategories: DefectCategory[];
  applicableTiers: TierCode[];
}

const ALL_CATEGORIES: DefectCategory[] = [
  "HOMELESMANGEL",
  "KOMPETANSEMANGEL",
  "UTREDNINGSPLIKTBRUDD",
  "KONTRADIKSJONSPARTSRETT",
  "BEGRUNNELSESMANGEL",
  "FEIL_FAKTUM_INNHOLD",
  "DATAINTEGRITET_TAUSHET",
  "EMK_PROSESS"
];

export const NorwegianRemedyCatalog: RemedyEntry[] = [
  {
    remedyId: "remedy-klage-overordnet",
    name: "Klage til overordnet forvaltningsorgan",
    description:
      "Klage på vedtak til nærmeste overordnede forvaltningsorgan i henhold til forvaltningsloven § 28.",
    jurisdiction: "NO",
    typicalDeadline: "3 uker fra vedtaksdato",
    applicableCategories: ALL_CATEGORIES,
    applicableTiers: ["T1", "T2", "T3"]
  },
  {
    remedyId: "remedy-sivilombudet",
    name: "Klage til Sivilombudet",
    description:
      "Klage til Sivilombudet over forvaltningens saksbehandling, kompetanse eller begrunnelsesplikt.",
    jurisdiction: "NO",
    typicalDeadline: "1 år fra avgjørelsen",
    applicableCategories: ["KOMPETANSEMANGEL", "BEGRUNNELSESMANGEL", "UTREDNINGSPLIKTBRUDD"],
    applicableTiers: ["T2"]
  },
  {
    remedyId: "remedy-domstol",
    name: "Domstolsbehandling (forvaltningsrettslig prøving)",
    description:
      "Søksmål for domstol om ugyldig forvaltningsvedtak etter alminnelig forvaltningsrettslig prøvingsrett.",
    jurisdiction: "NO",
    typicalDeadline: "3 år (foreldelse)",
    applicableCategories: ALL_CATEGORIES,
    applicableTiers: ["T1"]
  },
  {
    remedyId: "remedy-innsyn",
    name: "Krav om dokumentinnsyn (offl. § 3)",
    description:
      "Begjæring om innsyn i saksdokumenter etter offentleglova § 3 for å avdekke manglende utredning eller taushetspliktbrudd.",
    jurisdiction: "NO",
    typicalDeadline: "Umiddelbart",
    applicableCategories: ["DATAINTEGRITET_TAUSHET", "UTREDNINGSPLIKTBRUDD"],
    applicableTiers: ["T2"]
  },
  {
    remedyId: "remedy-omgjoring",
    name: "Begjæring om omgjøring (fvl. § 35)",
    description:
      "Begjæring til vedtaksorganet om omgjøring av ugyldig vedtak etter forvaltningsloven § 35.",
    jurisdiction: "NO",
    typicalDeadline: "Ingen absolutt frist, men bør fremsettes snarest",
    applicableCategories: ["HOMELESMANGEL", "KOMPETANSEMANGEL"],
    applicableTiers: ["T1", "T2"]
  },
  {
    remedyId: "remedy-erstatning",
    name: "Krav om erstatning (skl. § 2-1)",
    description:
      "Erstatningskrav mot staten for tap forårsaket av ulovlig forvaltningsvedtak, jf. skadeserstatningsloven § 2-1.",
    jurisdiction: "NO",
    typicalDeadline: "3 år fra den skadelidte fikk nødvendig kunnskap",
    applicableCategories: ALL_CATEGORIES,
    applicableTiers: ["T1"]
  }
];

export const SwedishRemedyCatalog: RemedyEntry[] = [
  {
    remedyId: "remedy-overvagan-se",
    name: "Överklagan till överordnad myndighet",
    description:
      "Överklagande av förvaltningsbeslut till närmast överordnad myndighet " +
      "enligt förvaltningslagen (2017:900) 40 §.",
    jurisdiction: "SE",
    typicalDeadline: "3 veckor från beslutsdatum",
    applicableCategories: [
      "HOMELESMANGEL", "KOMPETANSEMANGEL", "UTREDNINGSPLIKTBRUDD",
      "KONTRADIKSJONSPARTSRETT", "BEGRUNNELSESMANGEL",
      "FEIL_FAKTUM_INNHOLD", "DATAINTEGRITET_TAUSHET", "EMK_PROSESS"
    ],
    applicableTiers: ["T1", "T2", "T3"]
  },
  {
    remedyId: "remedy-jo-se",
    name: "Anmälan till JO (Justitieombudsmannen)",
    description:
      "Anmälan till Riksdagens ombudsmän (JO) om myndighetsmissbruk, " +
      "handläggningsfel eller brist på motivering.",
    jurisdiction: "SE",
    typicalDeadline: "Normalt inom 2 år från beslutet",
    applicableCategories: ["KOMPETANSEMANGEL", "BEGRUNNELSESMANGEL", "UTREDNINGSPLIKTBRUDD"],
    applicableTiers: ["T2"]
  },
  {
    remedyId: "remedy-forvaltningsdomstol-se",
    name: "Förvaltningsdomstol (förvaltningsrättslig prövning)",
    description:
      "Ansökan om rättslig prövning vid förvaltningsrätten av myndighetsbeslut " +
      "enligt förvaltningsprocesslagen (1971:291).",
    jurisdiction: "SE",
    typicalDeadline: "3 veckor från delgivning av beslutet",
    applicableCategories: [
      "HOMELESMANGEL", "KOMPETANSEMANGEL", "UTREDNINGSPLIKTBRUDD",
      "KONTRADIKSJONSPARTSRETT", "BEGRUNNELSESMANGEL",
      "FEIL_FAKTUM_INNHOLD", "DATAINTEGRITET_TAUSHET", "EMK_PROSESS"
    ],
    applicableTiers: ["T1"]
  },
  {
    remedyId: "remedy-omprovning-se",
    name: "Begäran om omprövning",
    description:
      "Begäran till beslutsmyndigheten om omprövning av felaktigt beslut " +
      "enligt förvaltningslagen (2017:900) 36-38 §§.",
    jurisdiction: "SE",
    typicalDeadline: "Ingen absolut frist — bör inges snarast",
    applicableCategories: ["HOMELESMANGEL", "KOMPETANSEMANGEL"],
    applicableTiers: ["T1", "T2"]
  }
];

/** Combined registry keyed by ISO 3166-1 alpha-2 jurisdiction code. */
export const ALL_REMEDY_CATALOGS: Record<string, RemedyEntry[]> = {
  NO: NorwegianRemedyCatalog,
  SE: SwedishRemedyCatalog
};
