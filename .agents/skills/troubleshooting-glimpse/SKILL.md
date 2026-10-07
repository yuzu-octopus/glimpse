---
name: troubleshooting-glimpse
description: Use when Glimpse fails to start, shows a stale or old dashboard after an update, reports EADDRINUSE on port 3000, rejects a `theme:` config block, shows widget error banners — or shows none at all, which is `show-errors: false` — drops config validation errors, fetches retried more than you expect, behaves oddly in the dev proxy, or when service worker / PWA cache staleness is suspected
---

# Troubleshooting Glimpse

## Overview
Two layers go stale independently: the browser's PWA service-worker cache, and the previous Bun process holding :3000. Most "update didn't take" reports are one of these, not the build.

## Symptom → cause → fix

| Symptom | Cause | Fix |
|---|---|---|
| `EADDRINUSE` on :3000 at startup | old server process from before restart still holds the socket | `lsof -ti tcp:3000 \| xargs kill`, then start again. Persistent offender: `pkill -f 'src/server/index.ts'` |
| Old UI after `git pull && bun run build`, even hard refresh | Workbox precache; `autoUpdate` SW activates immediately (skipWaiting+clientsClaim) but the already-open tab keeps executing the previously loaded bundle until it is reloaded — and one hard reload can still pull freshly-served index.html referencing assets mid-swap | Two consecutive reloads normally self-heal. Deterministic: DevTools → Application → Service Workers → Unregister, then Clear site data, close all :3000 tabs, reopen |
| Widget card shows red error text | upstream fetch failed AND no stale copy existed (24h retain). Error text is sanitized (query strings stripped) — safe to read | Check network/upstream; raise that widget's `cache`; error self-heals next successful fetch |
| A failing widget shows *nothing* — no banner, no red chrome, just the card | `show-errors: false` is set on it | expected. The status dot beside the title still reports the failure. Set it back to `true` to see the message |
| A fetch hangs for a long time before failing | `retries` (default 3, max 10) is multiplying the backoff across attempts | set `retries: 0` to try once, or a low value like `1` so a dead endpoint fails fast |
| Astryx components render core's built-in icons instead of Dracula's | `src/client/kit/icons` is not the first import in `src/main.tsx` | the icon registry is module-level state — the side-effecting import must run before the first render, above both core stylesheets |
| Chart series colour is wrong, or purple is encoding data | a hand-picked hue instead of `CHART_HUES`, which is purple-free by construction | import `CHART_HUES` from `astryx-dracula/shared/chart-hues`; reserve `--color-data-*` ramps for magnitude (a heatmap), never identity |
| Tag or bookmark chips change colour between rows | colour assigned by DOM position (`:nth-child`) | hash the identity through `tagAccent()` in `src/client/widgets/feed/tag-accent.ts` |
| `config.pages…widgets: custom-api: set url or at least one subrequests entry` | `custom-api` with neither a top-level `url` nor a `subrequests` entry | add one. Note that with a top-level `url` set, the subrequests are fetched but unreachable — the url payload is the root |
| Config edit ignored / dashboard unchanged | YAML failed zod validation on auto-reload — last good config stays active | Run `bun run check-config [path]` for line numbers + did-you-mean, or read server console: error names the exact JSON path. Fix and save again |
| Startup fails with validation errors listing `${VAR}` | referenced env var not exported | export it, or remove the reference. No `.env` loader exists |
| Dev :5173 has no data | `/api` must reach :3000 | start `bun run dev:server` too; vite proxies with changeOrigin |
| GitHub/Reddit widgets error intermittently | unauthenticated API rate limits | raise that widget's `cache` (e.g. `30m`) or set `GITHUB_TOKEN` |
| Everything slow on homelab page | expected: 1s live polling while a server-stats/system-stats widget is on the page | none needed; other pages poll every 30s only when live widgets exist |
| Config fails with `config.theme: block removed …` | the config predates the single-theme migration; a `theme:` key is now a validation error | delete the whole `theme:` block; move a custom stylesheet to top-level `custom-css-file:` (relative to config.yml's directory), then `bun run check-config` |
| No theme picker / appearance controls in Settings | expected: one theme, `astryx-dracula`, dark-only. Settings has About + Docs only | none needed — there is nothing to switch. To restyle, use `custom-css-file:` |
| Custom CSS edits seem to do nothing | `custom-css-file` is injected as an unlayered `<style>` from React, but `src/index.css` is also unlayered and loads first — an equal-specificity rule there wins | raise specificity in `custom.css` (`.widget-card .x` not `.x`), or move the rule into `src/index.css` if it is app-wide |
| Colors that don't match the Dracula brand | a leftover `:root` `--color-*` override in `src/index.css` — app CSS is unlayered and imported last, so it silently outranks the kit | delete the override; `astryx-dracula/tokens.css` is the source of truth. A real brand change is a kit version bump, not an app override |

## Quick facts
- Port override: `GLIMPSE_PORT=3001 bun run start`. Config path: first CLI arg > `GLIMPSE_CONFIG` > `./config.yml`.
- Health check: `curl localhost:3000/health`.
- Verify what the server actually serves: `curl -s "localhost:3000/api/page/<slug>" | head -c 400` (JSON) or append `?stream` to watch the NDJSON skeleton+chunks arrive.
- When measuring a freshly built UI, reset the PWA first: DevTools → Application → Service Workers → Unregister, then Clear site data, then reload. A stale precache will happily serve you the previous build and you will "discover" a bug that was fixed hours ago.
- `GET /api/config` returns `400` with `{ ok: false, errors: [...] }` when the config fails validation — curl it to see the exact JSON paths the browser swallowed.
- Theme assets are static (`/api/theme` carries only the optional custom CSS) — clear the SW cache, not a server cache.
