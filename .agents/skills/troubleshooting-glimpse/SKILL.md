---
name: troubleshooting-glimpse
description: Use when Glimpse fails to start, shows a stale or old dashboard after an update, reports EADDRINUSE on port 3000, shows widget error banners, drops config validation errors, behaves oddly in the dev proxy, or when service worker / PWA cache staleness is suspected
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
| Config edit ignored / dashboard unchanged | YAML failed zod validation on auto-reload — last good config stays active | Read server console: error names the exact JSON path. Fix and save again |
| Startup fails with validation errors listing `${VAR}` | referenced env var not exported | export it, or remove the reference. No `.env` loader exists |
| Dev :5173 has no data | `/api` must reach :3000 | start `bun run dev:server` too; vite proxies with changeOrigin |
| GitHub/Reddit widgets error intermittently | unauthenticated API rate limits | raise that widget's `cache` (e.g. `30m`) or set `GITHUB_TOKEN` |
| Everything slow on homelab page | expected: 1s live polling while a server-stats/system-stats widget is on the page | none needed; other pages poll every 30s only when live widgets exist |

## Quick facts
- Port override: `GLIMPSE_PORT=3001 bun run start`. Config path: first CLI arg > `GLIMPSE_CONFIG` > `./config.yml`.
- Health check: `curl localhost:3000/health`.
- Verify what the server actually serves: `curl -s "localhost:3000/api/page/<slug>" | head -c 400` (JSON) or append `?stream` to watch the NDJSON skeleton+chunks arrive.
- Theme looks half-applied in dev: `/api/theme` is cached by the SW for 60s (NetworkFirst 3s timeout) — wait or clear site data.
