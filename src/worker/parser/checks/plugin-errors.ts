import type { Check } from "../types";
import { couldNotLoadPluginRegex, legacyPluginRegex, pluginErrorRegex } from "../regexes";

export const pluginErrorsCheck: Check = {
  id: "plugin-errors",
  prefilter: ["Error occurred while enabling", "Error occurred while disabling", "Could not load '"],
  onLine(line, index, ctx) {
    let plugin: string;
    let version: string | null;
    let phase: "enabling" | "disabling" | "loading";

    const enableError = pluginErrorRegex.exec(line);
    if (enableError !== null) {
      phase = enableError[1] as "enabling" | "disabling";
      plugin = enableError[2];
      version = enableError[3];
    } else {
      const loadError = couldNotLoadPluginRegex.exec(line);
      if (loadError === null) return;
      phase = "loading";
      plugin = loadError[1];
      version = null;
    }

    // A broken plugin can error on every reload; dedupe by (plugin, phase) with a count.
    const existing = ctx.findings.pluginErrors.find((e) => e.plugin === plugin && e.phase === phase);
    if (existing) {
      existing.count++;
      existing.lineNumbers.push(index + 1);
    } else {
      ctx.findings.pluginErrors.push({ plugin, version, phase, count: 1, lineNumbers: [index + 1] });
    }
  },
};

export const legacyPluginsCheck: Check = {
  id: "legacy-plugins",
  prefilter: "does not specify an api-version",
  onLine(line, _index, ctx) {
    const match = legacyPluginRegex.exec(line);
    if (match === null) return;
    const name = match[1];
    if (!ctx.findings.legacyPlugins.some((p) => p.name === name)) {
      ctx.findings.legacyPlugins.push({ name, version: match[2] ?? null });
    }
  },
};
