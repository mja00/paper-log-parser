import type { Check } from "../types";
import { corruptionRegexes } from "../regexes";
import { stripPrefix } from "./util";

const MAX_SAMPLES = 5;

// Conservative pattern set — corruption phrasing varies by version, so matched lines are kept raw
// as evidence rather than parsed into fields.
export const worldCorruptionCheck: Check = {
  id: "world-corruption",
  prefilter: [
    "wrong location",
    "Failed to read chunk",
    "Failed to store chunk",
    "Failed to load chunk",
    "RegionFile",
    "Region file",
    "region file",
  ],
  onLine(line, index, ctx) {
    if (!corruptionRegexes.some((regex) => regex.test(line))) return;
    const { worldCorruption } = ctx.findings.startup;
    worldCorruption.count++;
    if (worldCorruption.samples.length < MAX_SAMPLES) {
      worldCorruption.samples.push(stripPrefix(line));
      worldCorruption.lineNumbers.push(index + 1);
    }
  },
};
