import type { Check } from "../types";
import { ambiguousPluginRegex } from "../regexes";

// The substring presence sets `detected` even if the strict regex fails to parse an entry, so the
// report still surfaces the ambiguity (matches legacy behavior).
export const ambiguousCheck: Check = {
  id: "ambiguous",
  prefilter: "Ambiguous plugin name",
  onLine(line, _index, ctx) {
    const { ambiguous } = ctx.findings;
    ambiguous.detected = true;
    const match = ambiguousPluginRegex.exec(line);
    if (match) {
      ambiguous.plugins.push({
        pluginName: match[2],
        pluginFilenames: match.slice(3).filter((g): g is string => g !== undefined),
      });
    }
  },
};
