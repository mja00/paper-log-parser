import { MAX_LOG_LENGTH } from "../constants";
import { type Check, type Findings, type ScanContext, newFindings } from "./types";
import { LINE_CHECKS, DERIVED_CHECKS } from "./checks";

function matchesPrefilter(line: string, prefilter: Check["prefilter"]): boolean {
  if (prefilter === undefined) return true;
  if (typeof prefilter === "string") return line.includes(prefilter);
  return prefilter.some((s) => line.includes(s));
}

// Single pass over the log (was ~13 independent passes). Each line is dispatched only to checks
// whose cheap substring prefilter matches, so regexes fire on candidates only. Finished checks are
// dropped from the active set. Derived checks then resolve cross-field state (version, cracked…).
export function analyzeLines(lines: string[]): Findings {
  const findings = newFindings();
  const ctx: ScanContext = { lines, findings, pluginsClosed: false, startingVersion: null };
  const active = [...LINE_CHECKS];

  for (let i = 0; i < lines.length && i <= MAX_LOG_LENGTH; i++) {
    const line = lines[i];
    if (line.includes("Preparing level")) ctx.pluginsClosed = true;
    // Iterate backwards so splicing a finished check doesn't skip its neighbor.
    for (let c = active.length - 1; c >= 0; c--) {
      const check = active[c];
      if (check.isDone?.(ctx)) {
        active.splice(c, 1);
        continue;
      }
      if (i > (check.maxLines ?? MAX_LOG_LENGTH)) continue;
      if (!matchesPrefilter(line, check.prefilter)) continue;
      check.onLine(line, i, ctx);
    }
  }

  for (const derived of DERIVED_CHECKS) derived.run(ctx);
  return findings;
}
