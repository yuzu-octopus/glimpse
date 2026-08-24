<p align="center">
  <img src="public/icon.svg" width="96" alt="Glimpse icon" />
</p>

<h1 align="center">Glimpse</h1>

<p align="center">
  A self-hosted, glance-inspired dashboard.<br/>
  YAML-configured widgets, all external data fetched server-side — API keys never reach the browser.
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#widgets">Widgets</a> ·
  <a href="#theming">Theming</a> ·
  <a href="#architecture">Architecture</a>
</p>

---

Built with **Bun**, **TypeScript**, **Vite**, **React 19** and the **Astryx** design system. Like [Glance](https://github.com/glanceapp/glance), Glimpse renders a dashboard from a YAML file — but under the hood it is a typed React SPA with a Bun API server, zod-validated config end to end, progressive NDJSON streaming, and per-widget code splitting.

> [!NOTE]
> Glimpse is **inspired by** [glanceapp/glance](https://github.com/glanceapp/glance) (MIT) and credits it for the concept: the YAML `pages` → `columns` → `widgets` layout, shared widget props (`title`, `title-url`, `hide-header`, `cache`, `css-class`), the HSL theme block, and the per-widget option vocabulary. It is not a port.

## Features

- **27 widget types** — feeds, homelab monitoring, containers, AI quota, timer, notepad — see [Widgets](#widgets)
- **48 theme presets** — curated base16 schemes + 6 glance classics, system / light / dark picker, glance-format HSL custom themes, custom CSS
- **12-column bento layout** — `pages` → `columns` (`span` tracks on a 12-col grid; legacy `size: small/full` still works), responsive remap on tablet/mobile, optional `head-widgets`
- **Progressive loading** — the server streams widgets as their data settles over a skeleton-first NDJSON stream; widget components are lazy chunks preloaded after first paint. Fast (cached/config-only) widgets paint instantly while slow API widgets show type-shaped skeletons and fill in as responses arrive; the server pre-warms its widget cache at boot and on config changes so the first visitor never waits on upstreams. Skeleton grid mirrors real column spans so layout never shifts.
- **Server-side fetching** — secrets configured once in the server environment; live SWR updates (1s poll for homelab pages, 30s otherwise) without losing stale content mid-refresh. GitHub-backed widgets (releases, repository) automatically use `GITHUB_TOKEN`/`GH_TOKEN` or a logged-in `gh` CLI token when available, lifting the API rate limit from 60 to 5,000 req/h
- **PWA** — installable app shell, offline precache, network-first API

## Quick start

Prerequisites: [Bun](https://bun.sh) ≥ 1.3.

```bash
bun install
cp config.example.yml config.yml
```

Development — two terminals:

```bash
bun run dev:server   # Bun API server on :3000 (auto-reloads on change)
bun run dev          # Vite dev server on :5173, proxies /api to :3000
```

Production:

```bash
bun run build && bun run start   # one process serves dist/ + API on :3000
```

## Configuration

Glimpse reads a YAML file (default `./config.yml`; override with the first CLI argument or `GLIMPSE_CONFIG`). The format mirrors glance's `glance.yml`:

```yaml
pages:
  - name: Home
    columns:
      - span: 3              # span tracks on 12-col grid (size: small/full still accepted)
        widgets:
          - type: clock
      - span: 9
        widgets:
          - type: rss
            title: Interesting reads
            limit: 10
            collapse-after: 3
            feeds:
              - url: https://selfh.st/rss/
                title: selfh.st
```

- Shared widget props: `title`, `title-url`, `hide-header`, `cache` (e.g. `12h`, `1d`; default 5m), `css-class`.
- `${ENV_VAR}` references in any string value are interpolated at load time (missing variable = validation error). The `${secret:name}` Docker-secrets syntax is not supported.
- `$include: <path>` merges another config file (relative to the including file; pages append, theme keys override).
- The config file is watched and auto-reloaded on save; last good config stays active on validation errors.
- All configs are zod-validated, including glance's structural rules (1–3 columns per page, columns require `size` or `span` — `span` explicit on all or none; when using `size`, exactly 1–2 `full` columns, no nested groups, unique slugs).

See [`config.example.yml`](config.example.yml) for a working four-page starting point.

### Environment variables

All optional; read from the process environment (no `.env` loader).

| Variable | Default | Purpose |
| --- | --- | --- |
| `GLIMPSE_CONFIG` | `./config.yml` | Config path (first CLI argument wins) |
| `GLIMPSE_PORT` | `3000` | Port of the Bun server |
| `GITHUB_TOKEN` | — | Bearer token for GitHub requests (`releases`, `repository`); raises the unauthenticated rate limit |

## Widgets

**Config-only** (no network): `bookmarks` · `search` (with bangs) · `clock` · `calendar` · `todo` · `notepad` · `timer` · `iframe` · `html`

**Containers**: `group` (tabbed) · `split-column` (side by side)

| Data widget | What it does | Source / notes |
| --- | --- | --- |
| `rss` | Items from multiple feeds | RSS/Atom via `Bun.XML`; per-feed custom headers |
| `hacker-news` | Front-page stories | Official Firebase API (`top` / `new` / `best`) |
| `reddit` | Subreddit posts or search | Reddit JSON API; OAuth client credentials supported |
| `releases` | Latest releases of tracked projects | GitHub, GitLab, Codeberg, Docker Hub |
| `weather` | Conditions + 7-day forecast | [open-meteo](https://open-meteo.com); no API key |
| `videos` | Latest videos from channels / playlists | YouTube RSS (`channel_id`, `@handle`, playlist); Shorts filtered unless `include-shorts` |
| `markets` | Quotes + sparklines | Yahoo Finance |
| `monitor` | HTTP health checks | Per-site `check-url`, `error-url`, timeouts, basic auth, alt status codes |
| `custom-api` | Items mapped from any JSON endpoint | JSONPath field mapping |
| `repository` | Repo stats + open PRs / issues | GitHub REST API |
| `lobsters` | lobste.rs stories | Configurable instance |
| `server-stats` | Health of configured local services | `systeminformation` probes |
| `system-stats` | CPU / GPU / RAM / disk of the host | `systeminformation`; 1s live poll when present |
| `dns-stats` | DNS server query stats | Pi-hole v6 (session auth) or Technitium |
| `docker-containers` | Container status | Docker Engine API over unix socket |
| `ai-quota` | AI provider quota (69 providers: Codex / Claude / OpenAI / Opencode etc.) | Ported from [CodexBar](https://github.com/steipete/CodexBar); token auto-resolved from env / `tokenFile` / `~/.codex/auth.json`; shows `used%`, reset countdown, plan/balance |
| `timer` | Circular countdown + stopwatch + notepad | Config-only; `duration: 25m` / `mm:ss`; editable ring, `notes: true` for scratch area |
| `notepad` | Minimal sticky textbox | Config-only; persists per `id` to `localStorage` |
Feed widgets respect the `cache` prop; unauthenticated GitHub/Reddit requests are rate-limited, so raise `cache` for those if you hit limits.

## Theming

- **Presets**: 48 built-in — 52 curated base16 schemes ([tinted-theming/schemes](https://github.com/tinted-theming/schemes), MIT; attribution in `src/shared/theme/schemes.generated.ts`) deduplicated into 42 entries (dark/light pairs share one entry) plus 6 glance classics.
- **Theme picker**: top-nav picker for system / light / dark mode plus any preset; persists in localStorage, applies live.
- **Custom theme**: the YAML `theme` block overrides preset colors in glance's HSL format (`background-color`, `primary-color`, `positive-color`, `negative-color`, …).
- **Custom CSS**: `theme.custom-css-file` is served with the theme and injected last so it wins.

> [!TIP]
> On first paint a tiny inline script restores your saved theme before React mounts — no white flash.

## Architecture

```
┌────────────────────────── Browser ──────────────────────────┐
│  React 19 SPA (Vite) · Astryx · PWA service worker          │
│  lazy widget chunks · theme picker · SWR hooks              │
│          │                                                  │
│  GET /api/config · /api/page/:slug?stream · /api/theme      │
└──────────┼──────────────────────────────────────────────────┘
           ▼
┌────────────────────────── Bun server (:3000) ───────────────┐
│  YAML config: zod-validated, ${ENV} interpolation,          │
│  $include, auto-reload (last-good kept on error)            │
│  skeleton-first NDJSON stream, per-widget TTL cache +       │
│  singleflight dedupe, stale-on-error fallback               │
└──────────┬──────────────────────────────────────────────────┘
           │  all external requests originate here;
           │  tokens never reach the browser
           ▼
  RSS/Atom · Hacker News · Reddit · GitHub · GitLab · Codeberg
  Docker Hub · open-meteo · Yahoo Finance · YouTube RSS · lobste.rs
  Pi-hole / Technitium · Docker Engine socket · any custom-api endpoint
```

`src/shared/` holds the zod config schemas and the theme pipeline and is imported by both sides, so client and server can never drift apart on the config contract. In development Vite (`:5173`) proxies `/api` to the Bun server (`:3000`); in production one process serves both.

## Known deviations from glance

- `custom-api` maps fields via JSONPath, not Go `html/template`.
- `todo` persists in browser localStorage only (per-browser, not shared).
- Authentication and brute-force lockout are not implemented.
- Not ported: `change-detection`, `extension`, `calendar-legacy`.
- `${secret:}` Docker-secrets syntax is unsupported.

## Development

```bash
bun run test        # vitest (jsdom); schema + fetcher + component tests per widget, no network
bun run test:watch
bunx tsc --noEmit   # strict typecheck gate
npx react-doctor@latest   # React quality scan (full scan is the gate)
```

Each widget ships three files — a shared zod schema, a server fetcher (data widgets), and a client component — joined by typed registries. Layout: `src/client/` (SPA), `src/server/` (Bun API), `src/shared/` (contracts used by both).

---

Inspired by [glanceapp/glance](https://github.com/glanceapp/glance) · MIT — see [LICENSE](LICENSE).
