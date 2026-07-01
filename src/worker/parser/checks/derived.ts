import type { DerivedCheck } from "../types";
import { paperVersion1Regex, paperVersion2Regex } from "../regexes";
import { isWeird } from "../plugins-db";

// Resolve flavor + Minecraft version from the captured lines. mcVersion is only set when a flavor
// line exists (legacy: getMcVersion was called only after finding one), preferring the clean
// "Starting minecraft server version" line, else the flavor line's API-version token.
const resolveVersion: DerivedCheck = {
  id: "resolve-version",
  run(ctx) {
    const f = ctx.findings;
    if (f.flavorLine === null) return;
    f.flavor = f.flavorLine.split("This server is running ")[1].split(" version ")[0].trim();
    if (ctx.startingVersion !== null) {
      f.mcVersion = ctx.startingVersion;
      return;
    }
    const block = f.flavorLine.split("(Implementing API version ")[1];
    if (block === undefined) return;
    const token = block.split(")")[0];
    // The suffix changed from `-R0.1-SNAPSHOT` (1.21.x) to `.build.<n>-<status>` (26.x).
    f.mcVersion = token.includes(".build.") ? token.split(".build.")[0] : token.split("-")[0];
  },
};

const resolvePaperVersion: DerivedCheck = {
  id: "resolve-paper-version",
  run(ctx) {
    const f = ctx.findings;
    if (f.flavor === null || f.flavorLine === null) return;
    const match = paperVersion1Regex.exec(f.flavor);
    const match2 = paperVersion2Regex.exec(f.flavorLine);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      f.paperVersion = Number.isNaN(parsed) ? null : parsed;
      f.runningPaper = true;
    } else if (match2) {
      const parsed = Number.parseInt(match2[1], 10);
      f.paperVersion = Number.isNaN(parsed) ? null : parsed;
      f.runningPaper = true;
    }
  },
};

const confirmPaper: DerivedCheck = {
  id: "confirm-paper",
  run(ctx) {
    const f = ctx.findings;
    if (f.flavor === null) return;
    if (f.flavor.includes("Paper version") && f.flavor.includes("git-Paper")) {
      f.runningPaper = true;
    }
  },
};

const crackedPlugins: DerivedCheck = {
  id: "cracked-plugins",
  run(ctx) {
    const f = ctx.findings;
    f.possiblyCracked.plugins = f.plugins.filter((p) => isWeird(p.name));
    f.possiblyCracked.cracked = f.possiblyCracked.plugins.length > 0;
  },
};

export const DERIVED_CHECKS: DerivedCheck[] = [
  resolveVersion,
  resolvePaperVersion,
  confirmPaper,
  crackedPlugins,
];
