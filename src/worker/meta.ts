import type { OgSnapshot } from "./cache";

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Build the conditional OG/Twitter/theme-color tags, matching the legacy
// Jinja template (only emitted when a log URL is present).
function metaTags(logUrl: string, og: OgSnapshot, origin: string): string {
  const pageUrl = `${origin}/?url=${encodeURIComponent(logUrl)}`;
  const imageUrl = `${origin}/og?url=${encodeURIComponent(logUrl)}`;
  const themeColor = og.isOffline ? "#ff0000" : "#00ff00";

  const tags = [
    `<meta property="og:title" content="Paper Log Parser">`,
    `<meta property="og:url" content="${escapeAttr(pageUrl)}">`,
    `<meta property="og:image" content="${escapeAttr(imageUrl)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="${escapeAttr(imageUrl)}">`,
  ];
  if (og.hasMalware) {
    tags.push(`<meta property="og:description" content="Congrats! You have malware!">`);
  }
  tags.push(`<meta name="theme-color" content="${themeColor}">`);
  return tags.join("");
}

// Inject the embed meta tags into the SPA's <head> for crawlers.
export function injectOgTags(assetResp: Response, logUrl: string, og: OgSnapshot, origin: string): Response {
  return new HTMLRewriter()
    .on("head", {
      element(el) {
        el.append(metaTags(logUrl, og, origin), { html: true });
      },
    })
    .transform(assetResp);
}
