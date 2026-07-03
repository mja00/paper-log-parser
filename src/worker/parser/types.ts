// Structured detection model. Detection populates a Findings; rendering (server report
// or client UI) is a separate concern that reads Findings — no ANSI, no pre-formatted strings.

export type Severity = "ok" | "warning" | "error" | "info" | "neutral";

export interface PluginInfo {
  name: string;
  version: string;
  // Derived from the plugin knowledge base (see plugins-db.ts): bad→error, meh→warning, else ok.
  severity: Severity;
}

export interface PlayerInfo {
  username: string;
  uuid: string;
}

export interface AmbiguousPlugin {
  pluginName: string;
  pluginFilenames: string[];
}

// One throwable in a trace: its short class name, message, `at …` frames, and any `… N more`
// truncation count.
export interface Throwable {
  type: string;
  message: string;
  frames: string[];
  truncated: number;
}

// A full stack trace: the root throwable followed by its `Caused by:`/`Suppressed:` chain.
// Identical traces (same types + frames, ignoring message) collapse into one, `count` tracks how
// many occurred and `lineNumbers` where each root header was seen.
export interface ExceptionTrace {
  throwables: Throwable[];
  count: number;
  lineNumbers: number[];
}

export interface InvalidConfig {
  locations: string[];
  validType: string;
  invalidType: string;
}

export interface Findings {
  mcVersion: string | null;
  flavor: string | null;
  flavorLine: string | null;
  runningPaper: boolean;
  paperVersion: number | null;
  latestPaperVersion: number | null;
  plugins: PluginInfo[];
  offline: { isOffline: boolean; usingProxy: boolean; proxyFlavor: string };
  possiblyCracked: { cracked: boolean; plugins: PluginInfo[] };
  malware: { detected: boolean; count: number };
  downgrade: { from: string; to: string } | null;
  players: PlayerInfo[];
  invalidPlayers: PlayerInfo[];
  // `detected` is tracked separately: a malformed "Ambiguous plugin name" line can set the flag
  // without a parseable entry, so it cannot be derived from `plugins.length`.
  ambiguous: { detected: boolean; plugins: AmbiguousPlugin[] };
  // A single missing dep is a bare string; multiple are grouped as a string[] (from one log line).
  missingDependencies: (string | string[])[];
  exceptions: ExceptionTrace[];
  pirated: { detected: boolean; lines: string[] };
  invalidConfig: InvalidConfig | null;
  startup: {
    portBindFailure: boolean;
    eulaNotAccepted: boolean;
    // Raw sample lines are kept as evidence — corruption phrasing varies a lot across versions.
    worldCorruption: { count: number; samples: string[]; lineNumbers: number[] };
  };
  // `count` is raw line hits (a trace's `Caused by:` OOM line counts too); `kinds` is deduped.
  oom: { detected: boolean; kinds: string[]; count: number; lineNumbers: number[] };
  javaEnv: {
    javaVersion: string | null;
    javaMajor: number | null;
    // Minimum for the detected MC version (or the log's own "requires Java N" statement).
    requiredJavaMajor: number | null;
    // From "Only up to Java N is supported" — the running Java is too NEW for this build.
    maxSupportedJavaMajor: number | null;
    vmWarnings: string[];
  };
  performance: {
    // One "event" per watchdog banner sighting (the banner prints once per dump).
    watchdog: {
      crashCount: number;
      maxUnresponsiveSeconds: number | null;
      // The vanilla watchdog's "Considering it to be crashed, server will forcibly shutdown."
      forcedShutdown: boolean;
      hasThreadDump: boolean;
      lineNumbers: number[];
    };
    // Aggregates only — this line can appear thousands of times in a laggy server's log.
    cantKeepUp: { count: number; totalMsBehind: number; totalTicksSkipped: number; maxMsBehind: number };
  };
}

export function newFindings(): Findings {
  return {
    mcVersion: null,
    flavor: null,
    flavorLine: null,
    runningPaper: false,
    paperVersion: null,
    latestPaperVersion: null,
    plugins: [],
    offline: { isOffline: false, usingProxy: false, proxyFlavor: "" },
    possiblyCracked: { cracked: false, plugins: [] },
    malware: { detected: false, count: 0 },
    downgrade: null,
    players: [],
    invalidPlayers: [],
    ambiguous: { detected: false, plugins: [] },
    missingDependencies: [],
    exceptions: [],
    pirated: { detected: false, lines: [] },
    invalidConfig: null,
    startup: {
      portBindFailure: false,
      eulaNotAccepted: false,
      worldCorruption: { count: 0, samples: [], lineNumbers: [] },
    },
    oom: { detected: false, kinds: [], count: 0, lineNumbers: [] },
    javaEnv: {
      javaVersion: null,
      javaMajor: null,
      requiredJavaMajor: null,
      maxSupportedJavaMajor: null,
      vmWarnings: [],
    },
    performance: {
      watchdog: {
        crashCount: 0,
        maxUnresponsiveSeconds: null,
        forcedShutdown: false,
        hasThreadDump: false,
        lineNumbers: [],
      },
      cantKeepUp: { count: 0, totalMsBehind: 0, totalTicksSkipped: 0, maxMsBehind: 0 },
    },
  };
}

// Shared state threaded through the single scanning pass. `startingVersion`, `pluginsClosed`, and
// `exceptionsConsumedThrough` are scratch used during the pass (never serialized); the report reads
// `findings`. `exceptionsConsumedThrough` is the last line index folded into a captured trace, so
// the exceptions check skips continuation lines it already consumed via look-ahead.
export interface ScanContext {
  lines: string[];
  findings: Findings;
  pluginsClosed: boolean;
  startingVersion: string | null;
  exceptionsConsumedThrough: number;
  // Line index of the last watchdog banner, so nearby banner repeats collapse into one event.
  lastWatchdogBanner: number;
}

// A line-scanning check. `prefilter` is a cheap substring gate (a superset of what the check's
// regex can match) so the driver only runs the body on candidate lines. `maxLines` caps how far
// the check scans (defaults to MAX_LOG_LENGTH). `isDone` lets the driver drop a finished check
// (e.g. plugins stop once "Preparing level" is seen).
export interface Check {
  id: string;
  prefilter?: string | string[];
  maxLines?: number;
  onLine(line: string, index: number, ctx: ScanContext): void;
  isDone?(ctx: ScanContext): boolean;
}

// Runs once after the pass, in registry order, over the accumulated context.
export interface DerivedCheck {
  id: string;
  run(ctx: ScanContext): void;
}
