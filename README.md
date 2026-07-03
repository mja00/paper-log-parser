# Paper Log Parser

Diagnoses Minecraft [Paper](https://papermc.io) server logs — server/plugin versions, offline
mode, common misconfigurations, and stack traces — and renders a structured findings report.

Live at **[paper.mart.fyi](https://paper.mart.fyi)**.

## Stack

A single [Cloudflare Worker](https://developers.cloudflare.com/workers/): a [Hono](https://hono.dev)
API + a [Vue 3](https://vuejs.org) SPA (Vite, Tailwind v4), with OG images generated on the edge via
[workers-og](https://github.com/kvnang/workers-og).

- `src/worker/` — API, parser engine (`parser/`), OG image + meta injection.
- `src/client/` — Vue SPA.
- `test/` — Vitest (unit + snapshot).

## Develop

```bash
pnpm install
pnpm dev        # Vite + Worker dev server
pnpm test       # Vitest
pnpm lint       # ESLint --fix
pnpm typecheck  # vue-tsc + tsc
```

## Deploy

```bash
pnpm deploy     # builds (predeploy) then wrangler deploy
```

Requires `wrangler login`. The `paper.mart.fyi` custom domain is provisioned automatically from the
`routes` config in `wrangler.jsonc`.
