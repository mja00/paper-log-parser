// Client-side view-model helpers over the parser's structured Findings — severity colors, the
// top-line verdict, and the status-tile row. The worker emits data; the client owns styling.
import type { Findings, Severity } from "../../worker/parser/types";

export const SEVERITY_COLORS: Record<Severity, string> = {
  ok: "#55FF55",
  warning: "#FFFF55",
  error: "#FF5555",
  info: "#55FFFF",
  neutral: "#FFFFFF",
};

// A null latest build means Paper publishes nothing for this version (unknown/EOL) → not supported.
// Shared so the status tiles and verdict can't disagree.
export function isSupported(f: Findings): boolean {
  return f.latestPaperVersion !== null;
}

export function isPaperUpToDate(f: Findings): boolean {
  return f.latestPaperVersion !== null && f.paperVersion === f.latestPaperVersion;
}

export interface Verdict {
  status: Severity;
  headline: string;
  // Count of things worth a look — drives the "· N issues found" subtitle.
  issueCount: number;
}

export interface StatusTile {
  label: string;
  value: string;
  severity: Severity;
  note?: string;
}

// Tallies distinct problem signals. Per-item categories (plugins in error, exceptions, invalid
// players, missing deps) count individually; boolean categories count once.
export function countIssues(f: Findings): number {
  let n = 0;
  if (f.malware.detected) n++;
  if (f.offline.isOffline) n++;
  if (f.possiblyCracked.cracked) n++;
  if (f.pirated.detected) n++;
  if (!isSupported(f)) n++;
  if (!f.runningPaper) n++;
  if (isSupported(f) && !isPaperUpToDate(f)) n++;
  if (f.downgrade) n++;
  if (f.invalidConfig) n++;
  if (f.ambiguous.detected) n++;
  n += f.invalidPlayers.length;
  n += f.exceptions.length;
  n += f.missingDependencies.length;
  n += f.plugins.filter((p) => p.severity === "error").length;
  return n;
}

// The single top-line signal. Worst-first: the first matching condition wins the headline.
export function buildVerdict(f: Findings): Verdict {
  const issueCount = countIssues(f);
  const pick = (status: Severity, headline: string): Verdict => ({ status, headline, issueCount });

  if (f.malware.detected) return pick("error", "Malware detected");
  if (f.pirated.detected || f.possiblyCracked.cracked) return pick("error", "Possibly cracked");
  if (f.offline.isOffline) return pick("error", "Offline mode");
  if (!isSupported(f)) return pick("error", "Unsupported version");
  // A downgrade means the world was saved by a newer MC version than the server runs — loading it
  // risks corruption, so this error outranks the not-Paper/outdated warnings below.
  if (f.downgrade) return pick("error", "Version downgrade");
  if (!f.runningPaper) return pick("warning", "Not running Paper");
  if (!isPaperUpToDate(f)) return pick("warning", "Paper is outdated");
  if (issueCount > 0) return pick("warning", "Issues found");
  return pick("ok", "Server looks healthy");
}

// The at-a-glance tile row shown above the detail sections.
export function buildStatusTiles(f: Findings): StatusTile[] {
  return [
    {
      label: "Minecraft",
      value: f.mcVersion ?? "Unknown",
      severity: isSupported(f) ? "ok" : "error",
      note: isSupported(f) ? undefined : "unsupported",
    },
    {
      label: "Flavor",
      value: f.flavor ?? "Unknown",
      // Mirror the verdict: unsupported is the only error; not-running-Paper is a warning.
      severity: !isSupported(f) ? "error" : f.runningPaper ? "ok" : "warning",
    },
    {
      label: "Paper build",
      value: f.paperVersion !== null ? `#${f.paperVersion}` : "Unknown",
      // A supported-but-outdated build is a warning; only an unsupported version is an error.
      severity: !isSupported(f) ? "error" : isPaperUpToDate(f) ? "ok" : "warning",
      note: !isPaperUpToDate(f) && f.latestPaperVersion !== null ? `latest #${f.latestPaperVersion}` : undefined,
    },
    {
      label: "Mode",
      value: f.offline.isOffline ? "Offline" : "Online",
      severity: f.offline.isOffline ? "error" : "ok",
      note: f.offline.usingProxy ? `${f.offline.proxyFlavor} proxy` : undefined,
    },
    {
      label: "Malware",
      value: f.malware.detected ? `${f.malware.count} hit${f.malware.count === 1 ? "" : "s"}` : "Clean",
      severity: f.malware.detected ? "error" : "ok",
    },
  ];
}
