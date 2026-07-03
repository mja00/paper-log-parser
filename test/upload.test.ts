import { afterEach, describe, expect, it, vi } from "vitest";
import { MCLOGS_MAX_BYTES, MCLOGS_MAX_LINES, truncateLog, uploadToMclogs } from "../src/client/lib/upload";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("truncateLog", () => {
  it("passes short content through untouched", () => {
    const { content, truncated } = truncateLog("line one\nline two");
    expect(content).toBe("line one\nline two");
    expect(truncated).toBe(false);
  });

  it("keeps the head when over the line cap", () => {
    const input = Array.from({ length: MCLOGS_MAX_LINES + 100 }, (_, i) => `line ${i}`).join("\n");
    const { content, truncated } = truncateLog(input);
    expect(truncated).toBe(true);
    const lines = content.split("\n");
    expect(lines).toHaveLength(MCLOGS_MAX_LINES);
    expect(lines[0]).toBe("line 0");
  });

  it("byte-caps on a line boundary", () => {
    const line = `${"x".repeat(1023)}\n`;
    const input = line.repeat(Math.ceil(MCLOGS_MAX_BYTES / 1024) + 5);
    const { content, truncated } = truncateLog(input);
    expect(truncated).toBe(true);
    expect(content.length).toBeLessThanOrEqual(MCLOGS_MAX_BYTES);
    expect(content.endsWith("\n")).toBe(true);
  });
});

describe("uploadToMclogs", () => {
  it("posts form-encoded content and returns the share url", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, id: "abc123", url: "https://mclo.gs/abc123" })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const url = await uploadToMclogs("some log");
    expect(url).toBe("https://mclo.gs/abc123");
    const [target, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(target).toBe("https://api.mclo.gs/1/log");
    expect(String(init.body)).toBe(new URLSearchParams({ content: "some log" }).toString());
  });

  it("throws the api error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: false, error: "Log is empty." }))),
    );
    await expect(uploadToMclogs("")).rejects.toThrow("Log is empty.");
  });
});
