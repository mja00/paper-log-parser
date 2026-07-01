import type { PlayerInfo } from "./types";

// Paper's v3 API strictly requires a User-Agent that identifies the app + a contact.
const USER_AGENT = "paper-log-parser/2.1 (+https://github.com/mja00/paper-log-parser)";
const FETCH_TIMEOUT_MS = 10_000;
// Cap on playerdb.co lookups + their concurrency, to stay under the Worker subrequest limit
// (50/req free, 1000 paid) on logs with many players.
const MAX_PLAYERS_VALIDATED = 25;
const PLAYER_VALIDATION_CONCURRENCY = 8;

function fetchWithUa(url: string, extraInit?: RequestInit): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    ...extraInit,
  });
}

// Stream the paste.gg HTML and capture the raw-download link's href. Replaces the legacy
// BeautifulSoup `a.is-pulled-right.button` lookup.
async function extractPasteGgRawHref(resp: Response): Promise<string | null> {
  let rawHref: string | null = null;
  const rewriter = new HTMLRewriter().on("a.is-pulled-right.button", {
    element(el) {
      if (rawHref === null) rawHref = el.getAttribute("href");
    },
  });
  await rewriter.transform(resp).text();
  return rawHref;
}

// Fetch a supported paste host and return its raw text (empty string for unsupported hosts).
export async function fetchLogText(url: string, host: string): Promise<string> {
  let resp: Response;
  switch (host) {
    case "paste.gg": {
      if (!url.endsWith("raw")) {
        const htmlResp = await fetchWithUa(url);
        const rawHref = await extractPasteGgRawHref(htmlResp);
        if (rawHref === null) return "";
        resp = await fetchWithUa(`https://paste.gg${rawHref}`);
      } else {
        resp = await fetchWithUa(url);
      }
      break;
    }
    case "pastes.dev":
      resp = await fetchWithUa(url.replace("pastes.dev", "api.pastes.dev"));
      break;
    case "api.pastes.dev":
      resp = await fetchWithUa(url);
      break;
    case "pastebin.com":
      resp = await fetchWithUa(url.replace("pastebin.com", "pastebin.com/raw"));
      break;
    case "mclo.gs": {
      const id = url.split("/").pop() ?? "";
      resp = await fetchWithUa(`https://api.mclo.gs/1/raw/${id}`);
      break;
    }
    default:
      return "";
  }
  return resp.text();
}

async function isPlayerInvalid(player: PlayerInfo): Promise<boolean> {
  try {
    // Edge-cache successful lookups for 30 min (players recur across a server's logs); never cache
    // error responses, so a transient 429 can't pin a player as "invalid".
    const resp = await fetchWithUa(`https://playerdb.co/api/player/minecraft/${player.uuid}`, {
      cf: { cacheEverything: true, cacheTtlByStatus: { "200-299": 1800, "400-599": 0 } },
    });
    if (resp.status === 200) {
      const data = (await resp.json()) as { data: { player: { username: string } } };
      // Non-matching username indicates a cracked/fake UUID.
      return data.data.player.username !== player.username;
    }
    // Non-200 (incl. 429) marks the player invalid — preserves the legacy behavior, which can
    // produce false positives under rate limiting.
    return true;
  } catch {
    return true;
  }
}

// Validate up to MAX_PLAYERS_VALIDATED players with a bounded worker pool; returns the invalid
// ones in their original order.
export async function validatePlayers(players: PlayerInfo[]): Promise<PlayerInfo[]> {
  const toValidate = players.slice(0, MAX_PLAYERS_VALIDATED);
  const results: boolean[] = new Array(toValidate.length).fill(false);

  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < toValidate.length) {
      const index = cursor++;
      results[index] = await isPlayerInvalid(toValidate[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(PLAYER_VALIDATION_CONCURRENCY, toValidate.length) }, () => worker()),
  );

  return toValidate.filter((_player, index) => results[index]);
}

// Latest Paper build for a version via the v3 "Fill" API (v2 was disabled 2026-07-01). Builds are
// returned newest-first; null for unknown/EOL versions (404) or lookup failures.
export async function getLatestPaperVersion(mcVersion: string | null): Promise<number | null> {
  if (mcVersion === null) return null;
  const apiUrl = `https://fill.papermc.io/v3/projects/paper/versions/${mcVersion}/builds`;
  const resp = await fetchWithUa(apiUrl, { cf: { cacheTtl: 1800, cacheEverything: true } });
  if (resp.status !== 200) return null;
  const data = (await resp.json()) as unknown;
  // Defensive: accept a bare array or a { builds: [...] } wrapper, and either build objects
  // (with numeric `id`) or plain build numbers.
  const builds = Array.isArray(data) ? data : (data as { builds?: unknown[] }).builds;
  const first = builds?.[0];
  if (first === undefined) return null;
  if (typeof first === "number") return first;
  const id = (first as { id?: number }).id;
  return typeof id === "number" ? id : null;
}
