// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import LogInput from "../src/client/components/LogInput.vue";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LogInput.vue", () => {
  it("submits a trimmed url in link mode", async () => {
    const wrapper = mount(LogInput, { props: { busy: false } });
    await wrapper.find("input#logUrl").setValue("  https://mclo.gs/abc123  ");
    await wrapper.find("form").trigger("submit");
    expect(wrapper.emitted("submit")?.at(-1)).toEqual(["https://mclo.gs/abc123"]);
  });

  it("shows the paste textarea when switching modes", async () => {
    const wrapper = mount(LogInput, { props: { busy: false } });
    expect(wrapper.find("textarea").exists()).toBe(false);
    await wrapper.findAll("[role=tab]")[1].trigger("click");
    expect(wrapper.find("textarea").exists()).toBe(true);
  });

  it("uploads pasted text to mclo.gs and emits the share url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ success: true, id: "abc123", url: "https://mclo.gs/abc123" })),
      ),
    );
    const wrapper = mount(LogInput, { props: { busy: false } });
    await wrapper.findAll("[role=tab]")[1].trigger("click");
    await wrapper.find("textarea").setValue("[12:00:00] [Server thread/INFO]: Done!");
    await wrapper.find("button.bg-accent").trigger("click");
    await vi.waitFor(() => {
      expect(wrapper.emitted("submit")?.at(-1)).toEqual(["https://mclo.gs/abc123"]);
    });
  });

  it("surfaces the mclo.gs error message on upload failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: false, error: "Log is empty." }))),
    );
    const wrapper = mount(LogInput, { props: { busy: false } });
    await wrapper.findAll("[role=tab]")[1].trigger("click");
    await wrapper.find("textarea").setValue("something");
    await wrapper.find("button.bg-accent").trigger("click");
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("Log is empty.");
    });
    expect(wrapper.emitted("submit")).toBeUndefined();
  });
});
