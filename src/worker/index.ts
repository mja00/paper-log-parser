import { Hono } from "hono";
import { parse } from "./cache";
import { renderOgImage } from "./og";
import { injectOgTags } from "./meta";

const app = new Hono<{ Bindings: Env }>();

// Serve the SPA shell, injecting embed meta tags for crawlers when ?url= is present.
app.get("/", async (c) => {
  const assetResp = await c.env.ASSETS.fetch(new Request(new URL("/", c.req.url)));
  const logUrl = c.req.query("url");
  if (!logUrl) return assetResp;
  try {
    const result = await parse(logUrl);
    const origin = new URL(c.req.url).origin;
    return injectOgTags(assetResp, logUrl, result.og, origin);
  } catch {
    // On parse failure just serve the unmodified shell (the SPA still loads).
    return assetResp;
  }
});

// Generate the OG status-card PNG, edge-cached by the request URL.
app.get("/og", async (c) => {
  const logUrl = c.req.query("url");
  if (!logUrl) return c.text("Missing url parameter", 400);

  const cache = caches.default;
  const cached = await cache.match(c.req.raw);
  if (cached) return cached;

  let result;
  try {
    result = await parse(logUrl);
  } catch {
    return c.text("Failed to parse log", 500);
  }

  const image = renderOgImage(result.og);
  const response = new Response(image.body, image);
  response.headers.set("Cache-Control", "public, max-age=86400");
  c.executionCtx.waitUntil(cache.put(c.req.raw, response.clone()));
  return response;
});

// Parse a log URL and return the report as ANSI-coded strings.
app.post("/parse", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { logUrl?: string | null };
  const logUrl = body.logUrl ?? null;
  if (logUrl === null) {
    return c.json({ error: "No log URL provided", success: false }, 400);
  }
  let result;
  try {
    result = await parse(logUrl);
  } catch {
    return c.json(
      { error: "Ran into an issue parsing the logs. Possible incomplete log file.", success: false },
      500,
    );
  }
  if (result.lineCount === 0) {
    return c.json({ error: "No log lines found. Most likely caused by an unsupported URL.", success: false }, 400);
  }
  return c.json({ findings: result.findings, success: true }, 200);
});

// Redirect to the dedicated version-age site (matches the legacy /age/<version> route).
app.get("/age/:version", (c) =>
  c.redirect(`https://minecraftishowold.today/${c.req.param("version")}`, 302),
);

// Everything else falls through to the static assets (the Vue SPA).
// not_found_handling: "single-page-application" serves index.html for client routes.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
