import type { Check } from "../types";
import { startingVersionRegex } from "../regexes";

// Captures the two version-bearing lines during the pass; resolution happens in derived.ts
// (order-dependent: flavor line → mc version → paper build).
export const versionCheck: Check = {
  id: "version",
  prefilter: ["This server is running", "Starting minecraft server version"],
  onLine(line, _index, ctx) {
    if (ctx.findings.flavorLine === null && line.includes("This server is running")) {
      ctx.findings.flavorLine = line;
    }
    if (ctx.startingVersion === null) {
      const match = startingVersionRegex.exec(line);
      if (match) ctx.startingVersion = match[1];
    }
  },
};
