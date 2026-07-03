import type { Check } from "../types";
import { versionCheck } from "./version";
import { pluginsCheck } from "./plugins";
import { ambiguousCheck } from "./ambiguous";
import { offlineCheck } from "./offline";
import { piratedCheck } from "./pirated";
import { dependenciesCheck } from "./dependencies";
import { exceptionsCheck } from "./exceptions";
import { downgradeCheck } from "./downgrade";
import { malwareCheck } from "./malware";
import { configCheck } from "./config";
import { playersCheck } from "./players";
import { watchdogCheck, cantKeepUpCheck } from "./performance";
import { portBindCheck, eulaCheck } from "./startup";
import { oomCheck } from "./oom";
import { worldCorruptionCheck } from "./corruption";
import { javaCheck } from "./java";

// The registry. Adding a check = one file + one entry here. Line checks write independent Findings
// fields, so their order is irrelevant; cross-field resolution lives in the derived checks.
export const LINE_CHECKS: Check[] = [
  versionCheck,
  pluginsCheck,
  ambiguousCheck,
  offlineCheck,
  piratedCheck,
  dependenciesCheck,
  exceptionsCheck,
  downgradeCheck,
  malwareCheck,
  configCheck,
  playersCheck,
  watchdogCheck,
  cantKeepUpCheck,
  portBindCheck,
  eulaCheck,
  oomCheck,
  worldCorruptionCheck,
  javaCheck,
];

export { DERIVED_CHECKS } from "./derived";
