# Glimpse

A self-hosted, glance-inspired dashboard built with Bun + TypeScript + Vite + React 19 and the Astryx design system. Like [Glance](https://github.com/glanceapp/glance), Glimpse renders a YAML-configured dashboard of widgets, but fetches all external data server-side: API keys and tokens live in the server environment and never reach the browser.

## Credits & design relation

Glimpse is **inspired by** [glanceapp/glance](https://github.com/glanceapp/glance) (MIT) and credits it for the concept: the YAML `pages` → `columns` → `widgets` layout, the shared widget props (`title`, `title-url`, `hide-header`, `cache`, `css-class`), the HSL theme block, and the per-widget option vocabulary. It is not a port. Under the hood the architecture is different and deliberately modern:

- **Server-rendered HTML (Go templates + vanilla JS) → typed React SPA** with a JSON API (`/api/page/:slug`) and per-widget components.
- **Widget configs are zod-validated** end to end (shared schemas used by both server and client), so a config error is a readable validation message, not a silent mis-render.
- **A real theme system**: 58 curated presets (base16) converted to Astryx tokens with light/dark pairs, an in-nav theme picker, and CSS-custom-property theming — not HSL-arithmetic per page.
- Server-side per-widget TTL caching + singleflight dedupe, skeleton loaders, error banners, and accessible components.

Where glance's config shapes fought that architecture we kept our own (e.g. `custom-api` uses JSONPath field mapping instead of Go `html/template`; `twitch-top-games` shows rank instead of viewer counts because the official Helix API does not expose them). Widgets we deliberately did not port: `docker-containers`, `dns-stats`, `server-stats`, `change-detection`, `extension`, `calendar-legacy`, plus glance's auth/brute-force lockout and `$include`-adjacent Docker-secrets syntax (`${secret:}`).

## Features

- **22 widget types**, grouped by how they work:

  - **Config-only** (no network): `bookmarks`, `search`, `clock`, `calendar`, `todo`, `iframe`, `html`
  - **Feeds** (server-fetched): `rss`, `hacker-news`, `reddit`, `releases`, `weather`, `lobsters`, `videos`, `markets`, `monitor`, `custom-api`, `repository`, `twitch-channels`, `twitch-top-games`
  - **Containers**: `group` (tabbed widgets), `split-column` (two widgets side by side)

- **Theming**: 58 presets (52 curated base16 schemes from [tinted-theming](https://github.com/tinted-theming/schemes) plus 6 glance classics), a nav theme picker (system / light / dark), and a YAML theme block in glance's HSL format for custom colors.
- **Glance-style layout**: `pages` → `columns` (small = 300px fixed, full = remaining width, up to 3 per page) → `widgets`; optional `head-widgets` above the columns.
- **PWA**: installable via `vite-plugin-pwa` with an offline app shell; API calls stay network-first.
- Server-side fetching means secrets are configured once, server-side (see [Environment variables](#environment-variables)).

## Quick start

Prerequisites: [Bun](https://bun.sh) >= 1.3.

```bash
bun install
cp config.example.yml config.yml
```

**Development** — two terminals:

```bash
bun run dev:server   # Bun API server on :3000 (auto-reloads on change)
bun run dev          # Vite dev server on :5173, proxies /api to :3000
```

**Production** — one server on :3000 serves both the built app and the API:

```bash
bun run build && bun run start
```

## Configuration

Glimpse reads a YAML file (default `./config.yml`, override with the first CLI argument or `GLIMPSE_CONFIG`). The format mirrors glance's `glance.yml`:

```yaml
pages:
  - name: Home
    columns:
      - size: small          # 300px fixed
        widgets:
          - type: clock
      - size: full           # remaining width; 1-2 full columns per page
        widgets:
          - type: rss
            title: Interesting reads
            limit: 10
            collapse-after: 3
            feeds:
              - url: https://selfh.st/rss/
                title: selfh.st
```

- Each widget takes the shared props `title`, `title-url`, `hide-header`, `cache` (e.g. `12h`, `1d`; default 5m), and `css-class`.
- The `theme` block follows glance's HSL format (`h s l`): `light`, `background-color`, `primary-color`, `positive-color`, `negative-color`, optional `contrast-multiplier` / `text-saturation-multiplier`, and `custom-css-file`.
- `${ENV_VAR}` references in any string value are interpolated from the environment at load time (a missing variable is a validation error). The `${secret:name}` Docker-secrets syntax is not supported.
- `$include: <path>` merges another config file (relative paths resolve against the including file; included pages are appended, included theme keys override).
- The config file is watched and auto-reloaded on save; if the new config fails validation the last good config stays active.
- All widget configs are validated through zod; structural rules from glance are enforced too (1–3 columns per page, exactly 1–2 `full` columns, no `group`/`split-column` nested inside a `group`, unique page slugs).

See `config.example.yml` for a working starting point.

## Widgets

| Type | What it does | Data source / notes |
| --- | --- | --- |
| `bookmarks` | Grouped link lists | Config-only |
| `search` | Search box with bangs, `s` keyboard shortcut | Config-only; `{QUERY}` placeholder in the engine URL |
| `clock` | Time in one or more timezones | Config-only |
| `calendar` | Month grid with today highlighted | Config-only |
| `todo` | Add / edit / delete todo items | Config-only; persists to browser localStorage |
| `iframe` | Embedded page | Config-only (`source`, `height`) |
| `html` | Raw HTML block | Config-only |
| `rss` | Items from multiple feeds | RSS/Atom via `rss-parser`; per-feed custom headers supported |
| `hacker-news` | Front-page stories | Official Firebase API (`top` / `new` / `best`) |
| `reddit` | Subreddit posts or search results | Reddit JSON API; sends a `User-Agent` header |
| `releases` | Latest releases of tracked projects | GitHub, GitLab, Codeberg, Docker Hub; optional `GITHUB_TOKEN` / `gitlab-token` |
| `weather` | Current conditions + 7-day forecast | [open-meteo](https://open-meteo.com) (geocoding + forecast); no API key |
| `lobsters` | Lobsters stories | lobste.rs JSON API (`hottest` / `newest`); `instance-url` configurable |
| `videos` | Latest videos from channels / playlists | YouTube RSS feeds (channel ID, `@handle`, or playlist ID); no API key |
| `markets` | Quotes with 21-day sparkline | Yahoo Finance chart API |
| `monitor` | HTTP health checks with response time | Server-side fetch, 5s timeout; `expected-status-code` (default 200) |
| `custom-api` | Items mapped from any JSON endpoint | JSONPath field mapping via `jsonpath-plus` |
| `repository` | GitHub repo stats + open PRs / issues | GitHub REST API; optional `GITHUB_TOKEN` |
| `twitch-channels` | Live status of Twitch channels | Twitch Helix API; requires `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` |
| `twitch-top-games` | Top games on Twitch | Twitch Helix API; requires `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` |
| `group` | Tabbed container of widgets | Config-only |
| `split-column` | Two widgets side by side | Config-only |

Feed widgets respect the `cache` prop; unauthenticated GitHub and Reddit requests are rate-limited, so raise `cache` for those if you hit limits.

## Environment variables

All variables are optional. They are read from the process environment (`export` them or run under your process manager); `.env` file loading is not built in.

| Variable | Default | Purpose |
| --- | --- | --- |
| `GLIMPSE_CONFIG` | `./config.yml` | Path to the config file (the first CLI argument takes precedence) |
| `GLIMPSE_PORT` | `3000` | Port for the Bun API server |
| `GITHUB_TOKEN` | — | Bearer token for GitHub API requests (`releases`, `repository`); raise the unauthenticated rate limit |
| `TWITCH_CLIENT_ID` | — | Twitch app client ID for `twitch-channels` / `twitch-top-games` |
| `TWITCH_CLIENT_SECRET` | — | Twitch app client secret for `twitch-channels` / `twitch-top-games` |

## Theming

- **Presets**: 58 built-in presets — 52 curated base16 schemes from [tinted-theming/schemes](https://github.com/tinted-theming/schemes) (MIT; per-scheme attribution is committed in `src/shared/theme/schemes.generated.ts`) plus 6 glance classics (Teal City, Camouflage, Tucan, Neon Pink, Peachy, Zebra).
- **Theme picker**: a `ThemePicker` in the top nav switches between system / light / dark mode and any preset; the choice persists in localStorage and applies live without a reload.
- **Custom theme**: the YAML `theme` block overrides the active preset's colors in glance's HSL format (`background-color`, `primary-color`, `positive-color`, `negative-color`, ...).
- **Custom CSS**: `theme.custom-css-file` is read by the server, served with the theme, and injected last so it wins over everything.

## Architecture

```
┌────────────────────────── Browser ──────────────────────────┐
│  React 19 SPA (Vite) · Astryx · PWA service worker          │
│  pages/widgets · theme picker · usePageData hook            │
│          │                                                  │
│          │  GET /api/config · /api/page/:slug · /api/theme  │
└──────────┼──────────────────────────────────────────────────┘
           ▼
┌────────────────────────── Bun server (:3000) ───────────────┐
│  YAML config: zod-validated, ${ENV} interpolation,          │
│  $include, auto-reload (last-good kept on error)            │
│  per-widget TTL cache + singleflight dedupe                 │
│  widget fetchers (registered per type)                      │
└──────────┬──────────────────────────────────────────────────┘
           │  all external requests originate here;
           │  tokens never reach the browser
           ▼
  RSS/Atom · Hacker News · Reddit · GitHub · GitLab · Codeberg
  Docker Hub · open-meteo · Yahoo Finance · Twitch Helix
  YouTube RSS · lobste.rs · any custom-api endpoint
```

`src/shared/` holds the zod config schemas and the theme pipeline (base16 → Astryx tokens, glance HSL parsing) and is imported by both the client and the server, so the two sides can never drift apart on the config contract. In development Vite (`:5173`) proxies `/api` to the Bun server (`:3000`); in production `bun run start` serves the built app from `dist/` and the API from one process.

## Known deviations from glance

- `custom-api` renders via JSONPath field mapping (`options.path` + per-field JSONPath expressions), not Go `html/template`.
- `twitch-top-games` shows rank without viewer counts — the official Helix `games/top` endpoint does not return them (glance uses a private GraphQL endpoint).
- `todo` persists in browser localStorage only (per-browser, not shared).
- Authentication and brute-force lockout are not implemented.
- Omitted widgets: `docker-containers`, `dns-stats`, `server-stats`, `change-detection`, `extension`, `calendar-legacy`.
- `${secret:}` Docker-secrets syntax is unsupported.

## Development

```bash
bun run test        # vitest (jsdom); fetcher + component tests per widget, no network
bun run test:watch
```

- Run `bunx react-doctor@latest --scope changed` as a gate before committing React work.
- Layout: `src/client/` (React SPA: widgets, pages, components, hooks, theme provider), `src/server/` (Bun API: config engine, cache, fetchers), `src/shared/` (zod schemas + theme pipeline used by both sides). Each widget ships three files — shared zod schema, server fetcher, client component — joined by typed registries.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 Yuzu Octopus.
