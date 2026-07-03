// Client-side re-upload to mclo.gs: pasted/dropped logs become a normal mclo.gs URL so the
// existing URL-based parse, share links, OG cards, and caching all work unchanged.

// Published mclo.gs limits (GET api.mclo.gs/1/limits); we pre-truncate so the API never rejects.
export const MCLOGS_MAX_BYTES = 10 * 1024 * 1024;
export const MCLOGS_MAX_LINES = 25_000;

export interface TruncateResult {
  content: string;
  truncated: boolean;
}

// Keep the HEAD when over the limits — version/flavor/plugins are startup lines, and the parser
// only scans the first MAX_LOG_LENGTH lines anyway.
export function truncateLog(content: string): TruncateResult {
  let truncated = false;
  let result = content;
  const lines = result.split("\n");
  if (lines.length > MCLOGS_MAX_LINES) {
    result = lines.slice(0, MCLOGS_MAX_LINES).join("\n");
    truncated = true;
  }
  if (result.length > MCLOGS_MAX_BYTES) {
    // Byte-cap then drop the (probably partial) final line.
    result = result.slice(0, MCLOGS_MAX_BYTES);
    result = result.slice(0, result.lastIndexOf("\n") + 1) || result;
    truncated = true;
  }
  return { content: result, truncated };
}

interface MclogsResponse {
  success: boolean;
  url?: string;
  error?: string;
}

// Uploads publicly (mclo.gs keeps pastes ~90 days) and returns the share URL.
// URLSearchParams keeps the request a "simple" CORS request (no preflight).
export async function uploadToMclogs(content: string): Promise<string> {
  const resp = await fetch("https://api.mclo.gs/1/log", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ content }),
  });
  const data = (await resp.json()) as MclogsResponse;
  if (!data.success || !data.url) {
    throw new Error(data.error ?? "Upload to mclo.gs failed.");
  }
  return data.url;
}

const GZIP_MAGIC = [0x1f, 0x8b];

// Read a picked/dropped log file, transparently gunzipping rotated logs (*.log.gz).
export async function readLogFile(file: File): Promise<string> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  const isGzip = head[0] === GZIP_MAGIC[0] && head[1] === GZIP_MAGIC[1];
  if (!isGzip) return file.text();
  try {
    const stream = file.stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  } catch {
    throw new Error("Couldn't decompress that .gz file — is it a valid gzip archive?");
  }
}
