import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { LogFile, splitLines } from "../src/worker/parser";
import { Fore } from "../src/worker/ansi";
import { getMcFromDataVersion } from "../src/worker/constants";
import { generateCard } from "../src/client/lib/bingo";

const FIXED_PAPER_BUILD = 999;
const fixturesDir = join(__dirname, "fixtures");
const goldenDir = join(__dirname, "golden");

// The flavor line used across fixtures (1.21.4, Paper build 26).
const FLAVOR_LINE =
  "[16:38:57] [Server thread/INFO]: This server is running Paper version 1.21.4-26-master@52ae4ad (2024-08-16T22:44:55Z) (Implementing API version 1.21.4-R0.1-SNAPSHOT)";

describe("LogFile report — golden parity with bug-patched Python", () => {
  // Only old-format fixtures have a Python-generated golden; modern (26.x) logs are asserted
  // explicitly below since the legacy Python oracle can't parse them.
  const fixtures = readdirSync(fixturesDir).filter(
    (f) => f.endsWith(".log") && existsSync(join(goldenDir, f.replace(".log", ".json"))),
  );

  for (const fixture of fixtures) {
    it(fixture, () => {
      const text = readFileSync(join(fixturesDir, fixture), "utf-8");
      const golden = JSON.parse(
        readFileSync(join(goldenDir, fixture.replace(".log", ".json")), "utf-8"),
      ) as string[];

      const log = new LogFile("");
      log.lines = splitLines(text);
      log.analyze();
      // "supported" now derives from latestPaperVersion. The golden colors were captured with
      // 1.21.4 as supported → non-null build. Reproduce null (red) where Paper wouldn't return a
      // build: the unsupported-version fixture, and no-flavor logs (no version to look up).
      const unsupported = fixture === "non-supported-version.log" || log.mcVersion === null;
      log.latestPaperVersion = unsupported ? null : FIXED_PAPER_BUILD;

      expect(log.getReportAsString()).toEqual(golden);
    });
  }
});

describe("LogFile network pipeline (mocked fetch)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates player UUIDs, resolves latest Paper build, reads mclo.gs", async () => {
    const uuidValid = "00000000-0000-0000-0000-000000000001";
    const uuidInvalid = "00000000-0000-0000-0000-000000000002";
    const logText = [
      FLAVOR_LINE,
      `[12:00:00] [User Authenticator #1/INFO]: UUID of player Steve is ${uuidValid}`,
      `[12:00:01] [User Authenticator #2/INFO]: UUID of player Cracked is ${uuidInvalid}`,
      "[12:00:02] [Server thread/INFO]: Preparing level \"world\"",
    ].join("\n");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes("api.mclo.gs")) return new Response(logText);
        if (url.includes("playerdb.co") && url.includes(uuidValid)) {
          return new Response(JSON.stringify({ data: { player: { username: "Steve" } } }));
        }
        if (url.includes("playerdb.co") && url.includes(uuidInvalid)) {
          return new Response(JSON.stringify({ data: { player: { username: "SomeoneElse" } } }));
        }
        if (url.includes("fill.papermc.io")) {
          // v3 returns build objects newest-first.
          return new Response(
            JSON.stringify([
              { id: 102, channel: "STABLE" },
              { id: 101, channel: "STABLE" },
              { id: 100, channel: "STABLE" },
            ]),
          );
        }
        return new Response("", { status: 404 });
      }),
    );

    const log = new LogFile("https://mclo.gs/abc123");
    await log.runChecks();

    expect(log.players.map((p) => p.username)).toEqual(["Steve", "Cracked"]);
    expect(log.invalidPlayers.map((p) => p.username)).toEqual(["Cracked"]);
    expect(log.latestPaperVersion).toBe(102);
    expect(log.mcVersion).toBe("1.21.4");
    expect(log.paperVersion).toBe(26);
  });

  it("returns no lines for an unsupported host", async () => {
    const log = new LogFile("https://example.com/whatever");
    await log.runChecks();
    expect(log.lines).toHaveLength(0);
  });

  it("treats a PaperMC 404 as an unknown (null) latest build", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes("api.mclo.gs")) return new Response(FLAVOR_LINE);
        return new Response("", { status: 404 });
      }),
    );
    const log = new LogFile("https://mclo.gs/xyz");
    await log.runChecks();
    expect(log.latestPaperVersion).toBeNull();
  });
});

describe("performance — large log", () => {
  it("analyzes a 10k-line log quickly", () => {
    const lines = [FLAVOR_LINE];
    for (let i = 0; i < 10_000; i++) lines.push(`[12:00:00] [Server thread/INFO]: tick ${i} doing things`);
    const log = new LogFile("");
    log.lines = lines;
    const start = performance.now();
    log.analyze();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });
});

describe("modern Paper (26.x) support", () => {
  it("parses the 26.2 log (new version scheme + build format)", () => {
    const text = readFileSync(join(fixturesDir, "paper-modern-26.2.log"), "utf-8");
    const log = new LogFile("");
    log.lines = splitLines(text);
    log.analyze();

    expect(log.mcVersion).toBe("26.2");
    expect(log.paperVersion).toBe(36);
    expect(log.flavor).toBe("Paper");
    expect(log.runningPaper).toBe(true);
    expect(log.isOffline).toBe(true);
    const names = log.plugins.map((p) => p.name);
    expect(names).toContain("ViaVersion");
    expect(names).toContain("ViaBackwards");

    // Latest build 40 (real) > running build 36 → red; version is published → supported/green.
    log.latestPaperVersion = 40;
    const report = log.getReportAsString();
    expect(report[0]).toBe(`${Fore.GREEN}Minecraft Version: 26.2${Fore.RESET}`);
    expect(report[2]).toBe(`${Fore.RED}Paper Version: 36${Fore.RESET}`);
  });

  it("falls back to the API-version token when no 'Starting' line is present", () => {
    const log = new LogFile("");
    log.lines = [
      "[14:55:23] [Server thread/INFO]: This server is running Paper version 26.1.2-63-main@711c5de (2026-05-11T08:20:02Z) (Implementing API version 26.1.2.build.63-stable)",
    ];
    log.analyze();
    expect(log.mcVersion).toBe("26.1.2");
    expect(log.paperVersion).toBe(63);
  });

  it("maps modern data versions and reports a downgrade", () => {
    expect(getMcFromDataVersion("4903")).toBe("26.2");
    expect(getMcFromDataVersion("4671")).toBe("1.21.11");
    expect(getMcFromDataVersion("99999")).toBe("99999"); // graceful fallback

    const log = new LogFile("");
    log.lines = [
      "java.lang.RuntimeException: Server attempted to load chunk saved with newer version of minecraft! 4903 > 4189",
    ];
    log.analyze();
    expect(log.attemptingToDowngrade).toBe(true);
    expect(log.downgradedVersions).toEqual(["26.2", "1.21.4"]);
  });
});

describe("bingo card generation", () => {
  it("is deterministic per seed, 25 cells, Free at center", () => {
    const card = generateCard(123);
    expect(card).toHaveLength(25);
    expect(card[12]).toBe("Free");
    expect(generateCard(123)).toEqual(card);
  });

  it("differs across seeds", () => {
    expect(generateCard(123)).not.toEqual(generateCard(124));
  });
});
