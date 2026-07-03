import type { Check } from "../types";
import { pluginRegex, serverPluginRegex } from "../regexes";
import { pluginSeverity } from "../plugins-db";

// Collects plugin load lines until "Preparing level" (the driver sets ctx.pluginsClosed, and
// isDone drops this check for the rest of the log).
export const pluginsCheck: Check = {
  id: "plugins",
  prefilter: "Loading",
  isDone: (ctx) => ctx.pluginsClosed,
  onLine(line, _index, ctx) {
    const regex = line.includes("server plugin") ? serverPluginRegex : pluginRegex;
    const match = regex.exec(line);
    if (match) {
      ctx.findings.plugins.push({ name: match[2], version: match[3], severity: pluginSeverity(match[2]) });
    }
  },
};
