// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addHistoryEntry, clearHistory, loadHistory, type HistoryEntry } from "../src/client/lib/history";

function makeEntry(url: string, parsedAt = 0): HistoryEntry {
  return { url, parsedAt, status: "ok", headline: "Server looks healthy", mcVersion: "26.2" };
}

beforeEach(() => {
  localStorage.clear();
});

describe("history", () => {
  it("returns an empty list with no stored history", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("adds entries newest-first and persists them", () => {
    addHistoryEntry(makeEntry("https://mclo.gs/a", 1));
    const list = addHistoryEntry(makeEntry("https://mclo.gs/b", 2));
    expect(list.map((e) => e.url)).toEqual(["https://mclo.gs/b", "https://mclo.gs/a"]);
    expect(loadHistory()).toEqual(list);
  });

  it("dedupes by url, moving the entry to the front", () => {
    addHistoryEntry(makeEntry("https://mclo.gs/a", 1));
    addHistoryEntry(makeEntry("https://mclo.gs/b", 2));
    const list = addHistoryEntry(makeEntry("https://mclo.gs/a", 3));
    expect(list.map((e) => e.url)).toEqual(["https://mclo.gs/a", "https://mclo.gs/b"]);
    expect(list[0].parsedAt).toBe(3);
  });

  it("caps the list at 10 entries", () => {
    for (let i = 0; i < 12; i++) addHistoryEntry(makeEntry(`https://mclo.gs/${i}`, i));
    const list = loadHistory();
    expect(list).toHaveLength(10);
    expect(list[0].url).toBe("https://mclo.gs/11");
  });

  it("recovers from corrupt stored json", () => {
    localStorage.setItem("plp:recent-parses", "{not json");
    expect(loadHistory()).toEqual([]);
    localStorage.setItem("plp:recent-parses", JSON.stringify([{ nope: true }, makeEntry("https://mclo.gs/ok")]));
    expect(loadHistory().map((e) => e.url)).toEqual(["https://mclo.gs/ok"]);
  });

  it("swallows storage quota errors", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => addHistoryEntry(makeEntry("https://mclo.gs/a"))).not.toThrow();
    spy.mockRestore();
  });

  it("clears history", () => {
    addHistoryEntry(makeEntry("https://mclo.gs/a"));
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
