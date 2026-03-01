// rules/sovereign-core-rulepack.ts

import { RulePack } from "./sovereign-rulepack-api";
import { R_DAG_CYCLE } from "./rules/r-dag-cycle";
import { R_CHAIN_CONTAMINATION } from "./rules/r-chain-contamination";
import { R_POST_CLOSURE_ACTIVITY } from "./rules/r-post-closure-activity";
import { R_BEGRUNNELSE } from "./rules/r-begrunnelsesmangel";
import { R_UTREDNINGSPLIKT } from "./rules/r-utredningsplikt";
import { R_KONTRADIKSJON } from "./rules/r-kontradiksjon";
import { R_STAGE_REGRESSION } from "./rules/r-stage-regression";
import { R_KOMPETANSEMANGEL } from "./rules/r-kompetansemangel";

export const SovereignCoreRulePack: RulePack = {
  id: "sovereign-core",
  version: "1.1.0",
  rules: [
    R_POST_CLOSURE_ACTIVITY,
    R_DAG_CYCLE,
    R_CHAIN_CONTAMINATION,
    R_BEGRUNNELSE,
    R_UTREDNINGSPLIKT,
    R_KONTRADIKSJON,
    R_STAGE_REGRESSION,
    R_KOMPETANSEMANGEL
  ]
};
