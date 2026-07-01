// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from "vitest";
import { mount } from "@vue/test-utils";
import LogOutput from "../src/client/components/LogOutput.vue";
import { buildReport } from "../src/client/lib/report";
import { newFindings } from "../src/worker/parser/types";

beforeAll(() => {
  // virtua measures elements via ResizeObserver, which happy-dom lacks.
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

describe("buildReport", () => {
  it("marks a supported, up-to-date Paper server as ok", () => {
    const f = newFindings();
    f.mcVersion = "1.21.4";
    f.flavor = "Paper";
    f.runningPaper = true;
    f.paperVersion = 100;
    f.latestPaperVersion = 100;
    const items = buildReport(f);
    expect(items.find((i) => i.text.startsWith("Minecraft Version"))?.severity).toBe("ok");
    expect(items.find((i) => i.text.startsWith("Server Flavor"))?.severity).toBe("ok");
    expect(items.find((i) => i.text.startsWith("Paper Version"))?.severity).toBe("ok");
  });

  it("flags unsupported version, offline mode, and bad plugins as errors", () => {
    const f = newFindings();
    f.offline.isOffline = true;
    f.plugins = [{ name: "AuthMe", version: "5.6", severity: "error" }];
    const items = buildReport(f);
    // latestPaperVersion is null (unknown/EOL) → unsupported → error.
    expect(items.find((i) => i.text.startsWith("Minecraft Version"))?.severity).toBe("error");
    expect(items.find((i) => i.text.startsWith("Offline Mode"))?.severity).toBe("error");
    expect(items.some((i) => i.text === "AuthMe v5.6" && i.severity === "error")).toBe(true);
  });

  it("renders raw log content as plain text (no markup)", () => {
    const f = newFindings();
    f.pirated.detected = true;
    f.pirated.lines = ["<script>alert(1)</script>"];
    const items = buildReport(f);
    // The raw line is carried verbatim as data; Vue escapes it at render time.
    expect(items.some((i) => i.text === "<script>alert(1)</script>")).toBe(true);
  });
});

describe("LogOutput.vue", () => {
  it("mounts without error and hosts the virtua list", async () => {
    const f = newFindings();
    f.plugins = [{ name: "TestPlugin", version: "1.0", severity: "ok" }];
    const wrapper = mount(LogOutput, { props: { findings: f } });
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".output").exists()).toBe(true);
  });
});
