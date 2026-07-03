import { describe, it, expect } from "vitest";
import { LogFile } from "../src/worker/parser";

// Analyze an in-memory log (no network) and return its findings.
function analyze(lines: string[]) {
  const log = new LogFile("");
  log.lines = lines;
  log.analyze();
  return log.findings;
}

describe("exceptions — full-trace parsing", () => {
  it("assembles frames, a Caused by chain, and the truncation count", () => {
    const { exceptions } = analyze([
      "[t] [Server thread/ERROR]: net.minecraft.server.ReportedException: Ticking entity",
      "[t] [Server thread/ERROR]: \tat net.minecraft.world.level.Level.tickEntity(Level.java:812)",
      "[t] [Server thread/ERROR]: Caused by: java.lang.NullPointerException: null world",
      "[t] [Server thread/ERROR]: \tat com.example.Handler.onTick(Handler.java:88)",
      "[t] [Server thread/ERROR]: \t... 3 more",
    ]);

    expect(exceptions).toHaveLength(1);
    const [trace] = exceptions;
    expect(trace.throwables.map((t) => t.type)).toEqual(["ReportedException", "NullPointerException"]);
    expect(trace.throwables[0].frames).toEqual(["at net.minecraft.world.level.Level.tickEntity(Level.java:812)"]);
    expect(trace.throwables[1].frames).toEqual(["at com.example.Handler.onTick(Handler.java:88)"]);
    expect(trace.throwables[1].truncated).toBe(3);
  });

  it("groups identical traces ignoring the message and records each line", () => {
    const { exceptions } = analyze([
      "[t] [Server thread/ERROR]: java.lang.IllegalStateException: zone alpha",
      "[t] [Server thread/ERROR]: \tat com.example.Zone.enter(Zone.java:22)",
      "[t] [Server thread/ERROR]: java.lang.IllegalStateException: zone bravo",
      "[t] [Server thread/ERROR]: \tat com.example.Zone.enter(Zone.java:22)",
    ]);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].count).toBe(2);
    expect(exceptions[0].lineNumbers).toEqual([0, 2]);
  });

  it("keeps traces whose frames differ separate", () => {
    const { exceptions } = analyze([
      "[t] [Server thread/ERROR]: java.lang.RuntimeException: boom",
      "[t] [Server thread/ERROR]: \tat com.example.A.run(A.java:1)",
      "[t] [Server thread/ERROR]: java.lang.RuntimeException: boom",
      "[t] [Server thread/ERROR]: \tat com.example.B.run(B.java:2)",
    ]);

    expect(exceptions).toHaveLength(2);
    expect(exceptions.every((t) => t.count === 1)).toBe(true);
  });

  it("ignores orphan frames and dependency exceptions handled elsewhere", () => {
    const { exceptions } = analyze([
      "[t] [Server thread/ERROR]: \tat com.example.Orphan.run(Orphan.java:9)",
      "[t] [Server thread/ERROR]: org.bukkit.plugin.UnknownDependencyException: Unknown/missing dependency plugins: [Vault]",
    ]);
    expect(exceptions).toHaveLength(0);
  });
});
