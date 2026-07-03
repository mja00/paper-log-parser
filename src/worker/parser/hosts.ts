// Curated paste-host allowlist shared by the worker (fetch dispatch) and the client (UI copy).
// Hosts needing HTML scraping (paste.gg) stay special-cased in network.ts; everything here is a
// pure URL rewrite so it can be unit-tested without fetch mocks.

// Display list for the client. api.* and *usercontent variants are accepted but not advertised.
export const SUPPORTED_HOSTS = [
  "paste.gg",
  "pastes.dev",
  "mclo.gs",
  "pastebin.com",
  "gist.github.com",
  "raw.githubusercontent.com",
  "paste.helpch.at",
];

// Map a supported URL to the raw-text URL to fetch, or null when the host isn't a simple rewrite
// (unsupported, or paste.gg which needs scraping).
export function resolveRawUrl(url: string, host: string): string | null {
  switch (host) {
    case "pastes.dev":
      return url.replace("pastes.dev", "api.pastes.dev");
    case "api.pastes.dev":
      return url;
    case "pastebin.com":
      return url.replace("pastebin.com", "pastebin.com/raw");
    case "mclo.gs":
      return `https://api.mclo.gs/1/raw/${url.split("/").pop() ?? ""}`;
    case "gist.github.com": {
      // Only user/id gist paths; /raw redirects to gist.githubusercontent.com (first file).
      const path = new URL(url).pathname.replace(/\/(raw.*)?$/, "");
      const segments = path.split("/").filter(Boolean);
      if (segments.length !== 2) return null;
      return `https://gist.github.com${path}/raw`;
    }
    case "gist.githubusercontent.com":
    case "raw.githubusercontent.com":
      return url;
    case "paste.helpch.at": {
      const u = new URL(url);
      if (!u.pathname.startsWith("/raw/")) u.pathname = `/raw${u.pathname}`;
      return u.toString();
    }
    default:
      return null;
  }
}
