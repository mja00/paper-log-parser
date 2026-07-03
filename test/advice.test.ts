import { describe, expect, it } from "vitest";
import { buildAdvice, PLUGIN_ADVICE } from "../src/client/lib/advice";
import { BAD_PLUGINS } from "../src/worker/parser/plugins-db";
import { newFindings } from "../src/worker/parser/types";

// A healthy, supported, up-to-date baseline so only injected findings produce advice.
function healthy() {
  const f = newFindings();
  f.runningPaper = true;
  f.mcVersion = "1.21.4";
  f.paperVersion = 100;
  f.latestPaperVersion = 100;
  return f;
}

describe("buildAdvice", () => {
  it("returns nothing for a healthy server", () => {
    expect(buildAdvice(healthy())).toEqual([]);
  });

  it("covers every bad plugin in the knowledge base", () => {
    for (const name of BAD_PLUGINS) {
      expect(PLUGIN_ADVICE[name], `missing advice for ${name}`).toBeDefined();
    }
  });

  it("orders malware first", () => {
    const f = healthy();
    f.malware.detected = true;
    f.offline.isOffline = true;
    f.oom.detected = true;
    expect(buildAdvice(f)[0].id).toBe("malware");
  });

  it("interpolates the latest build into the outdated advice", () => {
    const f = healthy();
    f.paperVersion = 90;
    const item = buildAdvice(f).find((i) => i.id === "outdated");
    expect(item?.title).toBe("Update Paper to build #100");
  });

  it("emits one item per distinct bad plugin", () => {
    const f = healthy();
    f.plugins = [
      { name: "AuthMe", version: "5.6", severity: "error" },
      { name: "AuthMe", version: "5.6", severity: "error" },
      { name: "PlugMan", version: "2.0", severity: "error" },
      { name: "EssentialsX", version: "2.20", severity: "ok" },
    ];
    const pluginItems = buildAdvice(f).filter((i) => i.id.startsWith("plugin-"));
    expect(pluginItems.map((i) => i.id).sort()).toEqual(["plugin-AuthMe", "plugin-PlugMan"]);
  });

  it("flattens grouped missing dependencies", () => {
    const f = healthy();
    f.missingDependencies = ["Vault", ["ProtocolLib", "PlaceholderAPI"]];
    const item = buildAdvice(f).find((i) => i.id === "missing-deps");
    expect(item?.body).toContain("Vault, ProtocolLib, PlaceholderAPI");
  });

  it("names the required java version", () => {
    const f = healthy();
    f.javaEnv.javaMajor = 8;
    f.javaEnv.requiredJavaMajor = 21;
    const item = buildAdvice(f).find((i) => i.id === "java-old");
    expect(item?.title).toBe("Install Java 21");
  });

  it("suggests spark for severe lag but not when the watchdog already fired", () => {
    const f = healthy();
    f.performance.cantKeepUp.totalTicksSkipped = 800;
    expect(buildAdvice(f).some((i) => i.id === "lag")).toBe(true);
    f.performance.watchdog.crashCount = 1;
    const ids = buildAdvice(f).map((i) => i.id);
    expect(ids).toContain("watchdog");
    expect(ids).not.toContain("lag");
  });
});
