// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory, type Router } from "vue-router";
import Bingo from "../src/client/pages/Bingo.vue";

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { template: "<div/>" } },
      { path: "/bingo", component: Bingo },
    ],
  });
}

describe("Bingo.vue rendering", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the PAPER header and a 25-cell card for a given seed", async () => {
    const router = makeRouter();
    await router.push("/bingo?seed=123");
    await router.isReady();
    const wrapper = mount(Bingo, { global: { plugins: [router] } });
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".flex-header").text().replace(/\s+/g, "")).toBe("PAPER");
    const cells = wrapper.findAll(".flex-row .flex-cell");
    expect(cells).toHaveLength(25);
    // Center cell is the free space.
    expect(cells[12].find("img").exists()).toBe(true);
  });

  it("marks a cell as a chip on click and wins a full row", async () => {
    const router = makeRouter();
    await router.push("/bingo?seed=42");
    await router.isReady();
    const wrapper = mount(Bingo, { global: { plugins: [router] } });
    await wrapper.vm.$nextTick();

    const firstRow = wrapper.findAll(".flex-row")[0];
    const rowCells = firstRow.findAll(".flex-cell");

    await rowCells[0].trigger("click");
    expect(rowCells[0].classes()).toContain("chip");
    expect(firstRow.classes()).not.toContain("win");

    // Mark the remaining cells in the row → row win.
    for (let i = 1; i < 5; i++) await rowCells[i].trigger("click");
    expect(wrapper.findAll(".flex-row")[0].classes()).toContain("win");
  });

  it("persists marks to localStorage and a ?state= URL param", async () => {
    const router = makeRouter();
    await router.push("/bingo?seed=7");
    await router.isReady();
    const wrapper = mount(Bingo, { global: { plugins: [router] } });
    await wrapper.vm.$nextTick();

    await wrapper.findAll(".flex-row .flex-cell")[0].trigger("click");
    const stored = JSON.parse(localStorage.getItem("bingo") ?? "{}");
    expect(stored["7"][0][0]).toBe(true);
    expect(new URL(window.location.href).searchParams.get("state")).toBeTruthy();
  });
});
