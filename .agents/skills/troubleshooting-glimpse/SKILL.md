---
name: troubleshooting-glimpse
description: Use when Glimpse fails to start, shows a stale or old dashboard after an update, reports EADDRINUSE on port 3000, rejects a `theme:` config block, shows widget error banners, drops config validation errors, behaves oddly in the dev proxy, or when service worker / PWA cache staleness is suspected
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
- Theme assets are static (`/api/theme` carries only the optional custom CSS) — clear the SW cache, not a server cache.
