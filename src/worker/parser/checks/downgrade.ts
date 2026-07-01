import type { Check } from "../types";
import { attemptedDowngradeRegex } from "../regexes";
import { getMcFromDataVersion } from "../../constants";

// Last match wins, matching the legacy overwrite behavior.
export const downgradeCheck: Check = {
  id: "downgrade",
  prefilter: "Server attempted to load chunk saved with newer version of minecraft!",
  onLine(line, _index, ctx) {
    const match = attemptedDowngradeRegex.exec(line);
    if (match) {
      ctx.findings.downgrade = { from: getMcFromDataVersion(match[1]), to: getMcFromDataVersion(match[2]) };
    }
  },
};
