import type { Check } from "../types";

// A single missing dep is stored as a bare string; a comma-separated list becomes a string[].
export const dependenciesCheck: Check = {
  id: "missing-deps",
  prefilter: "org.bukkit.plugin.UnknownDependencyException",
  onLine(line, _index, ctx) {
    let dependencies = line.split("Unknown/missing dependency plugins: ")[1].split(".")[0];
    dependencies = dependencies.replace(/\[/g, "").replace(/\]/g, "");
    ctx.findings.missingDependencies.push(dependencies.includes(",") ? dependencies.split(",") : dependencies);
  },
};
