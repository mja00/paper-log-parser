import { describe, expect, it } from "vitest";
import { normalizeJavaMajor, requiredJavaFor } from "../src/worker/parser/checks/java";
import { analyzeLines } from "../src/worker/parser/engine";

describe("normalizeJavaMajor", () => {
  it("handles the legacy 1.x scheme", () => {
    expect(normalizeJavaMajor("1.8.0_312")).toBe(8);
  });
  it("handles the modern scheme", () => {
    expect(normalizeJavaMajor("17.0.9")).toBe(17);
    expect(normalizeJavaMajor("21")).toBe(21);
  });
  it("rejects garbage", () => {
    expect(normalizeJavaMajor("banana")).toBeNull();
  });
});

describe("requiredJavaFor", () => {
  it.each([
    ["1.16.5", 8],
    ["1.17.1", 16],
    ["1.18.2", 17],
    ["1.20.4", 17],
    ["1.20.5", 21],
    ["1.21.4", 21],
    ["26.2", 25],
  ])("%s requires Java %d", (mc, java) => {
    expect(requiredJavaFor(mc)).toBe(java);
  });
  it("returns null for unparseable versions", () => {
    expect(requiredJavaFor("25w10a")).toBeNull();
  });
});

describe("javaCheck integration", () => {
  it("reads a too-new java signal from the unsupported banner", () => {
    const findings = analyzeLines([
      "[16:38:57] [ServerMain/ERROR]: Unsupported Java detected (61.0). Only up to Java 16 is supported.",
    ]);
    // Class-file major 61 = Java 17.
    expect(findings.javaEnv.javaMajor).toBe(17);
    expect(findings.javaEnv.maxSupportedJavaMajor).toBe(16);
  });

  it("prefers the log's own requires statement over the version table", () => {
    const findings = analyzeLines([
      "[16:38:57] [ServerMain/INFO]: Starting minecraft server version 1.18.2",
      "[16:38:57] [Server thread/INFO]: This server is running Paper version 1.18.2-388-master@abc (Implementing API version 1.18.2-R0.1-SNAPSHOT)",
      "[16:38:57] [ServerMain/ERROR]: Minecraft 1.18 and newer requires running the server with Java 18 or above",
    ]);
    expect(findings.javaEnv.requiredJavaMajor).toBe(18);
  });

  it("captures a crash-report java version line", () => {
    const findings = analyzeLines(['[16:38:57] [ServerMain/INFO]: Java Version: "17.0.9"']);
    expect(findings.javaEnv.javaVersion).toBe("17.0.9");
    expect(findings.javaEnv.javaMajor).toBe(17);
  });
});
