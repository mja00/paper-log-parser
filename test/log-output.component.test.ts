// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from "vitest";
import { mount } from "@vue/test-utils";
import LogOutput from "../src/client/components/LogOutput.vue";
import { ansiColorParse } from "../src/client/lib/ansi";

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

describe("ansiColorParse", () => {
  it("maps ANSI color codes to the Minecraft hex palette", () => {
    expect(ansiColorParse("\x1b[32mgreen\x1b[39m")).toBe(
      '<code style="color: #55FF55; padding-left: 2px;">green</code>',
    );
    expect(ansiColorParse("\x1b[31mred\x1b[39m")).toContain("#FF5555");
  });

  it("HTML-escapes log content before adding color tags", () => {
    const out = ansiColorParse("\x1b[31m<script>alert(1)</script>\x1b[39m");
    expect(out).toContain("&lt;script&gt;");
    expect(out).not.toContain("<script>");
  });

  it("handles bold and italic toggles", () => {
    expect(ansiColorParse("\x1b[1mbold\x1b[22m")).toBe("<b>bold</b>");
    expect(ansiColorParse("\x1b[3mital\x1b[23m")).toBe("<i>ital</i>");
  });
});

describe("LogOutput.vue", () => {
  it("mounts without error and hosts the virtua list", async () => {
    const wrapper = mount(LogOutput, {
      props: { lines: ["\x1b[32mhello\x1b[39m", "\x1b[31mworld\x1b[39m"] },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".output").exists()).toBe(true);
  });
});
