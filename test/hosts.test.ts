import { describe, expect, it } from "vitest";
import { resolveRawUrl, SUPPORTED_HOSTS } from "../src/worker/parser/hosts";

const resolve = (url: string) => resolveRawUrl(url, new URL(url).hostname);

describe("resolveRawUrl", () => {
  it("rewrites pastes.dev to its api host", () => {
    expect(resolve("https://pastes.dev/abc123")).toBe("https://api.pastes.dev/abc123");
    expect(resolve("https://api.pastes.dev/abc123")).toBe("https://api.pastes.dev/abc123");
  });

  it("rewrites pastebin.com to /raw", () => {
    expect(resolve("https://pastebin.com/abc123")).toBe("https://pastebin.com/raw/abc123");
  });

  it("rewrites mclo.gs to the raw api", () => {
    expect(resolve("https://mclo.gs/abc123")).toBe("https://api.mclo.gs/1/raw/abc123");
  });

  it("appends /raw to user/id gist urls", () => {
    expect(resolve("https://gist.github.com/mja00/deadbeef")).toBe(
      "https://gist.github.com/mja00/deadbeef/raw",
    );
    // Already-raw links normalize to the same fetch URL.
    expect(resolve("https://gist.github.com/mja00/deadbeef/raw")).toBe(
      "https://gist.github.com/mja00/deadbeef/raw",
    );
  });

  it("rejects gist urls that are not user/id paths", () => {
    expect(resolve("https://gist.github.com/mja00")).toBeNull();
    expect(resolve("https://gist.github.com/discover")).toBeNull();
  });

  it("passes githubusercontent urls through unchanged", () => {
    const raw = "https://raw.githubusercontent.com/mja00/repo/main/latest.log";
    expect(resolve(raw)).toBe(raw);
    const gistRaw = "https://gist.githubusercontent.com/mja00/deadbeef/raw/latest.log";
    expect(resolve(gistRaw)).toBe(gistRaw);
  });

  it("rewrites paste.helpch.at to /raw", () => {
    expect(resolve("https://paste.helpch.at/abc123")).toBe("https://paste.helpch.at/raw/abc123");
    expect(resolve("https://paste.helpch.at/raw/abc123")).toBe("https://paste.helpch.at/raw/abc123");
  });

  it("returns null for unsupported hosts and paste.gg", () => {
    expect(resolve("https://example.com/latest.log")).toBeNull();
    expect(resolve("https://paste.gg/p/anonymous/abc123")).toBeNull();
  });

  it("advertises the new hosts", () => {
    expect(SUPPORTED_HOSTS).toContain("gist.github.com");
    expect(SUPPORTED_HOSTS).toContain("raw.githubusercontent.com");
    expect(SUPPORTED_HOSTS).toContain("paste.helpch.at");
  });
});
