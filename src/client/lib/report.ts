// Builds a flat, severity-tagged view model from the parser's structured Findings. Replaces the
// legacy ANSI string report + ansiColorParse — the worker now emits data, the client owns styling.
import type { Findings, Severity } from "../../worker/parser/types";

export interface ReportItem {
  kind: "header" | "entry";
  text: string;
  severity: Severity;
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  ok: "#55FF55",
  warning: "#FFFF55",
  error: "#FF5555",
  info: "#55FFFF",
  neutral: "#FFFFFF",
};

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

export function buildReport(f: Findings): ReportItem[] {
  const items: ReportItem[] = [];
  const entry = (text: string, severity: Severity): void => {
    items.push({ kind: "entry", text, severity });
  };
  const header = (text: string, severity: Severity = "neutral"): void => {
    items.push({ kind: "header", text, severity });
  };

  // A null latest build means Paper publishes nothing for this version (unknown/EOL) → not supported.
  const supported = f.latestPaperVersion !== null;
  entry(`Minecraft Version: ${f.mcVersion ?? "Unknown"}`, supported ? "ok" : "error");
  entry(`Server Flavor: ${f.flavor ?? "Unknown"}`, f.runningPaper ? "ok" : "error");
  const paperUpToDate = f.latestPaperVersion !== null && f.paperVersion === f.latestPaperVersion;
  entry(`Paper Version: ${f.paperVersion ?? "Unknown"}`, paperUpToDate ? "ok" : "error");
  entry(`Offline Mode: ${yesNo(f.offline.isOffline)}`, f.offline.isOffline ? "error" : "ok");
  if (f.offline.usingProxy) entry(`Using ${f.offline.proxyFlavor} proxy`, "info");
  entry(`Malware Detected: ${yesNo(f.malware.detected)}`, f.malware.detected ? "error" : "ok");

  if (f.downgrade) {
    entry(
      `Server is attempting to downgrade from ${f.downgrade.from} to ${f.downgrade.to} — this is not supported!`,
      "error",
    );
  }

  if (f.invalidPlayers.length > 0) {
    header("Invalid player UUIDs", "error");
    for (const player of f.invalidPlayers) entry(`${player.username} — ${player.uuid}`, "error");
    entry("These UUIDs either do not exist, or are for different usernames.", "error");
  }

  header("Plugins");
  for (const plugin of f.plugins) entry(`${plugin.name} v${plugin.version}`, plugin.severity);

  if (f.ambiguous.detected) {
    header("Ambiguous plugins", "warning");
    for (const plugin of f.ambiguous.plugins) {
      entry(`${plugin.pluginName}: ${plugin.pluginFilenames.join(", ")}`, "warning");
    }
  }

  if (f.missingDependencies.length > 0) {
    header("Missing dependencies", "info");
    for (const dependency of f.missingDependencies) {
      entry(Array.isArray(dependency) ? dependency.join(", ") : dependency, "info");
    }
  }

  if (f.possiblyCracked.cracked) {
    header("Possibly cracked — these plugins suggest it", "info");
    for (const plugin of f.possiblyCracked.plugins) entry(`${plugin.name} v${plugin.version}`, plugin.severity);
  }

  if (f.pirated.detected) {
    header("Pirated plugins — these lines suggest it", "info");
    for (const line of f.pirated.lines) entry(line, "info");
  }

  if (f.exceptions.length > 0) {
    header("Exceptions", "info");
    for (const exception of f.exceptions) entry(`Line ${exception.lineNumber}: ${exception.line}`, "warning");
  }

  if (f.invalidConfig) {
    header("Invalid config", "error");
    const path = f.invalidConfig.locations.join(".");
    entry(`At ${path}: expected ${f.invalidConfig.validType}, got ${f.invalidConfig.invalidType}`, "error");
  }

  return items;
}
