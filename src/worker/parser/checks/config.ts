import type { Check } from "../types";
import { badConfigRegex } from "../regexes";

// Only the first CoercionFailedException is reported. Extracts structured data (locations, the
// expected type, and the offending type); rendering the "mock config" is left to the renderer.
export const configCheck: Check = {
  id: "config",
  prefilter: "org.spongepowered.configurate.serialize.CoercionFailedException",
  onLine(line, _index, ctx) {
    if (ctx.findings.invalidConfig !== null) return;
    const matches = [...line.matchAll(badConfigRegex)];
    ctx.findings.invalidConfig = {
      locations: (matches[0]?.[2] ?? "").split(", "),
      validType: matches[1]?.[3] ?? "",
      invalidType: matches[2]?.[3] ?? "",
    };
  },
};
