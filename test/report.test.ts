import { describe, it, expect } from "vitest";
import { buildVerdict, buildStatusTiles, countIssues } from "../src/client/lib/report";
import { newFindings } from "../src/worker/parser/types";

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
    f.exceptions = [{ line: "boom", lineNumber: 1 }];
    // offline + unsupported (null latest) + not-paper + 1 error plugin + 1 exception = 5
    expect(countIssues(f)).toBe(5);
  });
});
