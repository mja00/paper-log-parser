import { LogFile, type Findings } from "./parser";

// Snapshot of the fields the OG card and meta-tag injection need, so /og and meta.ts never
// re-parse a URL that /parse already handled.
export interface OgSnapshot {
  url: string;
  isOffline: boolean;
  hasMalware: boolean;
  hasPiratedPlugins: boolean;
  usingProxy: boolean;
  proxyFlavor: string;
  flavorLine: string | null;
  pluginCount: number;
  invalidConfig: boolean;
  invalidConfigLocations: string[];
  exceptionCount: number;
}

export interface ParseResult {
  lineCount: number;
  findings: Findings;
  og: OgSnapshot;
}

const PARSE_TTL_SECONDS = 300;

function ogFromFindings(url: string, findings: Findings): OgSnapshot {
  return {
    url,
    isOffline: findings.offline.isOffline,
    hasMalware: findings.malware.detected,
    hasPiratedPlugins: findings.pirated.detected,
    usingProxy: findings.offline.usingProxy,
    proxyFlavor: findings.offline.proxyFlavor,
    flavorLine: findings.flavorLine,
    pluginCount: findings.plugins.length,
    invalidConfig: findings.invalidConfig !== null,
    invalidConfigLocations: findings.invalidConfig?.locations ?? [],
    exceptionCount: findings.exceptions.length,
  };
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function cacheKey(url: string): Promise<Request> {
  return new Request(`https://parse-cache.internal/${await sha256Hex(url)}`);
}

async function computeParse(url: string): Promise<ParseResult> {
  const logFile = new LogFile(url);
  await logFile.runChecks();
  return {
    lineCount: logFile.lines.length,
    findings: logFile.findings,
    og: ogFromFindings(url, logFile.findings),
  };
}

// Parse a log URL once and share the result across /parse, /og, and meta.ts via the Cache API.
// Exceptions propagate (and are NOT cached) so /parse can 500.
export async function parse(url: string): Promise<ParseResult> {
  const cache = caches.default;
  const key = await cacheKey(url);
  const cached = await cache.match(key);
  if (cached) {
    return (await cached.json()) as ParseResult;
  }
  const result = await computeParse(url);
  await cache.put(
    key,
    new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `max-age=${PARSE_TTL_SECONDS}`,
      },
    }),
  );
  return result;
}
