import { describe, it, expect } from "vitest";
import { buildVerdict, buildStatusTiles, countIssues } from "../src/client/lib/report";
import { newFindings, type ExceptionTrace, type Throwable } from "../src/worker/parser/types";

function trace(type: string): ExceptionTrace {
  const throwable: Throwable = { type, message: "boom", frames: [], truncated: 0 };
  return { throwables: [throwable], count: 1, lineNumbers: [1], suspectedPlugins: [] };
}

describe("buildStatusTiles", () => {
  it("marks a supported, up-to-date Paper server as ok", () => {
    const f = newFindings();
    f.mcVersion = "1.21.4";
    f.flavor = "Paper";
    f.runningPaper = true;
    f.paperVersion = 100;
    f.latestPaperVersion = 100;
    const byLabel = Object.fromEntries(buildStatusTiles(f).map((t) => [t.label, t]));
    expect(byLabel["Minecraft"].severity).toBe("ok");
    expect(byLabel["Flavor"].severity).toBe("ok");
    expect(byLabel["Paper build"].severity).toBe("ok");
    expect(byLabel["Mode"].severity).toBe("ok");
  });

  it("flags unsupported version and offline mode as errors", () => {
    const f = newFindings();
    f.offline.isOffline = true;
    // latestPaperVersion is null (unknown/EOL) → unsupported → error.
    const byLabel = Object.fromEntries(buildStatusTiles(f).map((t) => [t.label, t]));
    expect(byLabel["Minecraft"].severity).toBe("error");
    expect(byLabel["Mode"].severity).toBe("error");
  });

  it("notes the proxy flavor when a proxy is in use", () => {
    const f = newFindings();
    f.offline.isOffline = true;
    f.offline.usingProxy = true;
    f.offline.proxyFlavor = "Velocity";
    const mode = buildStatusTiles(f).find((t) => t.label === "Mode");
    expect(mode?.note).toBe("Velocity proxy");
  });
});

describe("buildVerdict", () => {
  it("reports a clean server as healthy", () => {
    const f = newFindings();
    f.runningPaper = true;
    f.paperVersion = 100;
    f.latestPaperVersion = 100;
    const v = buildVerdict(f);
    expect(v.status).toBe("ok");
    expect(v.issueCount).toBe(0);
  });

  it("prioritizes malware over other signals", () => {
    const f = newFindings();
    f.malware.detected = true;
    f.offline.isOffline = true;
    expect(buildVerdict(f).headline).toBe("Malware detected");
  });

  it("counts per-item and boolean issues", () => {
    const f = newFindings();
    f.offline.isOffline = true;
    f.plugins = [{ name: "AuthMe", version: "5.6", severity: "error" }];
    f.exceptions = [trace("NullPointerException")];
    // offline + unsupported (null latest) + not-paper + 1 error plugin + 1 exception = 5
    expect(countIssues(f)).toBe(5);
  });

  it("ranks crash-class errors above version hygiene, oom first", () => {
    const f = newFindings();
    f.oom.detected = true;
    f.performance.watchdog.crashCount = 1;
    f.startup.portBindFailure = true;
    expect(buildVerdict(f).headline).toBe("Out of memory");
    f.oom.detected = false;
    expect(buildVerdict(f).headline).toBe("Server crashed");
    f.performance.watchdog.crashCount = 0;
    expect(buildVerdict(f).headline).toBe("Port already in use");
  });

  it("flags java too old as an error verdict", () => {
    const f = newFindings();
    f.runningPaper = true;
    f.paperVersion = 100;
    f.latestPaperVersion = 100;
    f.javaEnv.javaMajor = 8;
    f.javaEnv.requiredJavaMajor = 21;
    expect(buildVerdict(f).headline).toBe("Java too old");
  });

  it("reports severe lag as a warning once errors are ruled out", () => {
    const f = newFindings();
    f.runningPaper = true;
    f.paperVersion = 100;
    f.latestPaperVersion = 100;
    f.performance.cantKeepUp = { count: 20, totalMsBehind: 40000, totalTicksSkipped: 800, maxMsBehind: 9000 };
    const v = buildVerdict(f);
    expect(v.status).toBe("warning");
    expect(v.headline).toBe("Severe lag");
  });

  it("does not double-count oom-rooted exception traces", () => {
    const f = newFindings();
    f.runningPaper = true;
    f.paperVersion = 100;
    f.latestPaperVersion = 100;
    f.oom.detected = true;
    f.exceptions = [trace("OutOfMemoryError"), trace("NullPointerException")];
    // oom (1) + non-oom exception (1) = 2; the OOM trace itself is excluded.
    expect(countIssues(f)).toBe(2);
  });
});

describe("new status tiles", () => {
  it("shows an ok java tile when compatible", () => {
    const f = newFindings();
    f.javaEnv.javaMajor = 21;
    f.javaEnv.requiredJavaMajor = 21;
    const java = buildStatusTiles(f).find((t) => t.label === "Java");
    expect(java?.value).toBe("Java 21");
    expect(java?.severity).toBe("ok");
  });

  it("flags too-old java with the required version note", () => {
    const f = newFindings();
    f.javaEnv.javaMajor = 8;
    f.javaEnv.requiredJavaMajor = 21;
    const java = buildStatusTiles(f).find((t) => t.label === "Java");
    expect(java?.severity).toBe("error");
    expect(java?.note).toBe("needs ≥ 21");
  });

  it("summarizes lag on the lag tile", () => {
    const f = newFindings();
    f.performance.cantKeepUp = { count: 3, totalMsBehind: 38386, totalTicksSkipped: 767, maxMsBehind: 26579 };
    const lag = buildStatusTiles(f).find((t) => t.label === "Lag");
    expect(lag?.value).toBe("767 ticks behind");
    expect(lag?.severity).toBe("warning");
  });

  it("shows crashed on the lag tile when the watchdog fired", () => {
    const f = newFindings();
    f.performance.watchdog.crashCount = 2;
    f.performance.watchdog.maxUnresponsiveSeconds = 60;
    const lag = buildStatusTiles(f).find((t) => t.label === "Lag");
    expect(lag?.value).toBe("Crashed");
    expect(lag?.severity).toBe("error");
    expect(lag?.note).toBe("unresponsive 60s");
  });
});
