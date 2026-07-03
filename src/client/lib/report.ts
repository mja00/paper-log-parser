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

// Aggregate skipped ticks above this reads as sustained lag rather than a one-off hiccup.
export const SEVERE_LAG_TICKS = 200;

// "old" = below the version's minimum; "new" = above what this build supports (Paper refused to
// start and printed "Only up to Java N is supported").
export function javaIncompatibility(f: Findings): "old" | "new" | null {
  const { javaMajor, requiredJavaMajor, maxSupportedJavaMajor } = f.javaEnv;
  if (javaMajor !== null && maxSupportedJavaMajor !== null && javaMajor > maxSupportedJavaMajor) return "new";
  if (javaMajor !== null && requiredJavaMajor !== null && javaMajor < requiredJavaMajor) return "old";
  return null;
}

export function hasWatchdogCrash(f: Findings): boolean {
  return f.performance.watchdog.crashCount > 0 || f.performance.watchdog.forcedShutdown;
}

// OOM traces are deliberately double-captured (dedicated field + full trace); exclude them from
// the exceptions tally when OOM is already counted so one crash isn't two issues.
export function nonOomExceptions(f: Findings): Findings["exceptions"] {
  if (!f.oom.detected) return f.exceptions;
  return f.exceptions.filter((e) => !e.throwables.some((t) => t.type === "OutOfMemoryError"));
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
  if (f.oom.detected) n++;
  if (hasWatchdogCrash(f)) n++;
  if (f.performance.cantKeepUp.count > 0) n++;
  if (f.startup.portBindFailure) n++;
  if (f.startup.eulaNotAccepted) n++;
  if (f.startup.worldCorruption.count > 0) n++;
  if (javaIncompatibility(f) !== null) n++;
  if (f.legacyPlugins.length > 0) n++;
  n += f.pluginErrors.length;
  n += f.invalidPlayers.length;
  n += nonOomExceptions(f).length;
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
  // Hard failures: these are why the log was pasted, so they outrank version hygiene.
  if (f.oom.detected) return pick("error", "Out of memory");
  if (hasWatchdogCrash(f)) return pick("error", "Server crashed");
  if (f.startup.portBindFailure) return pick("error", "Port already in use");
  if (f.startup.eulaNotAccepted) return pick("error", "EULA not accepted");
  if (f.startup.worldCorruption.count > 0) return pick("error", "World corruption suspected");
  if (!isSupported(f)) return pick("error", "Unsupported version");
  // A downgrade means the world was saved by a newer MC version than the server runs — loading it
  // risks corruption, so this error outranks the not-Paper/outdated warnings below.
  if (f.downgrade) return pick("error", "Version downgrade");
  if (javaIncompatibility(f) === "old") return pick("error", "Java too old");
  if (javaIncompatibility(f) === "new") return pick("error", "Java too new for this build");
  if (!f.runningPaper) return pick("warning", "Not running Paper");
  if (!isPaperUpToDate(f)) return pick("warning", "Paper is outdated");
  if (f.performance.cantKeepUp.totalTicksSkipped > SEVERE_LAG_TICKS) return pick("warning", "Severe lag");
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
    {
      label: "Java",
      value: f.javaEnv.javaMajor !== null ? `Java ${f.javaEnv.javaMajor}` : "Unknown",
      severity: javaIncompatibility(f) !== null ? "error" : f.javaEnv.javaMajor !== null ? "ok" : "neutral",
      note:
        javaIncompatibility(f) === "old" && f.javaEnv.requiredJavaMajor !== null
          ? `needs ≥ ${f.javaEnv.requiredJavaMajor}`
          : javaIncompatibility(f) === "new" && f.javaEnv.maxSupportedJavaMajor !== null
            ? `build supports ≤ ${f.javaEnv.maxSupportedJavaMajor}`
            : undefined,
    },
    {
      label: "Lag",
      value: hasWatchdogCrash(f)
        ? "Crashed"
        : f.performance.cantKeepUp.count > 0
          ? `${f.performance.cantKeepUp.totalTicksSkipped} ticks behind`
          : "Stable",
      severity: hasWatchdogCrash(f)
        ? "error"
        : f.performance.cantKeepUp.totalTicksSkipped > SEVERE_LAG_TICKS
          ? "warning"
          : f.performance.cantKeepUp.count > 0
            ? "info"
            : "ok",
      note: f.performance.watchdog.maxUnresponsiveSeconds !== null
        ? `unresponsive ${f.performance.watchdog.maxUnresponsiveSeconds}s`
        : undefined,
    },
  ];
}
