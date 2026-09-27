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

Built with **Bun**, **TypeScript**, **Vite**, **React 19**, the **Astryx** design system, and the **astryx-dracula** theme. Like [Glance](https://github.com/glanceapp/glance), Glimpse renders a dashboard from a YAML file — but under the hood it is a typed React SPA with a Bun API server, zod-validated config end to end, progressive NDJSON streaming, and per-widget code splitting.

> [!NOTE]
> Glimpse is **inspired by** [glanceapp/glance](https://github.com/glanceapp/glance) (MIT) and credits it for the concept: the YAML `pages` → `columns` → `widgets` layout, shared widget props (`title`, `title-url`, `hide-header`, `cache`, `css-class`), and the per-widget option vocabulary. It is not a port.

## Features

- **42 widget types** — feeds, homelab monitoring, containers, smart-home state, VPN tailnets, AI quota, model availability, media, twitch, timers, calendars, radar, trending — see [Widgets](#widgets)
- **One theme — [astryx-dracula](https://github.com/yuzu-octopus/astryx-dracula)** — the pure Dracula brand for Astryx, dark-only by design: 270+ brand tokens, JetBrains Mono for body/heading/code, a fixed status vocabulary, and a shared chart layer (5 purple-free categorical hues plus 55 `--color-data-*` ramp tokens). No presets, no light mode, no picker; `custom-css-file:` is the only override
- **12-column bento layout** — `pages` → `columns` (`span` tracks on a 12-col grid; legacy `size: small/full` still works) plus a `tiling: collage` mode driven by one pure `place()` module, responsive 12/6/1 tracks on desktop/tablet/mobile, optional `head-widgets`
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
        title: Clock           # optional: names the column itself (mobile section header)
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

- Shared widget props: `title`, `title-url`, `hide-header`, `css-class`, `retries` (extra fetch attempts, 0–10, default 3), `show-errors` (default true; `false` mutes the error banner, and the header status dot still reports the failure).
- A column takes an optional `title`, which names the whole stack and is what the mobile section header reads. Unlabelled, the header falls back to the column's first widget title, then to `Column N` — name your columns if you want the mobile headers to say what they are.
- `cache` accepts glance's duration syntax (`45s`, `12h`, `1d`). With no `cache` set the default TTL comes from the widget kind: 1s for `server-stats` / `system-stats`, 10m for `weather-radar`, 60s for the live types (`clock`, `weather`, `markets`, `monitor`, `server-stats`, `system-stats`), 1h for everything else.
- Only those six live types also poll themselves (1s on a page containing `server-stats` / `system-stats`, 30s otherwise). Every other widget re-reads on tab focus, route change, or reload — so a state widget you want to look live (`home-assistant`, `tailscale`, `ai-quota`, …) needs an explicit short `cache: 60s`; without one the server hands back the same cached payload for up to an hour.
- `${ENV_VAR}` references in any string value are interpolated at load time (missing variable = validation error); `${ENV_VAR:-fallback}` supplies a default instead of failing. The `${secret:name}` Docker-secrets syntax is not supported.
- `$include: <path>` merges another config file (relative to the including file; pages append, `custom-css-file` takes the last include's value).
- The config file is watched and auto-reloaded on save; last good config stays active on validation errors.
- All configs are zod-validated, including glance's structural rules: 1–3 columns per page, columns require `size` or `span` (`span` explicit on all or none), when using `size` a page has 1 or 2 `full` columns, a `group` cannot contain another `group` or `split-column`, and page slugs must be unique.
- Glance's `to-do` and `stocks` type names load as aliases for `todo` and `markets` — at any nesting depth, including inside `group` / `split-column` — and fold to the canonical name at validation time.

See [`config.example.yml`](config.example.yml) for a working four-page starting point (Home / Dev / Social / Lab).

### Environment variables

Server variables, all optional, read from the process environment (no `.env` loader):

| Variable | Default | Purpose |
| --- | --- | --- |
| `GLIMPSE_CONFIG` | `./config.yml` | Config path (first CLI argument wins) |
| `GLIMPSE_PORT` | `3000` | Port of the Bun server |
| `GITHUB_TOKEN` / `GH_TOKEN` | — | Bearer token for GitHub requests (`releases`, `repository`); falls back to `gh auth token`, then unauthenticated |

Widgets also read their own credentials from the environment — `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET`, `IMMICH_API_KEY`, `JELLYFIN_API_KEY`, `QBITTORRENT_USERNAME` / `QBITTORRENT_PASSWORD`, `TRANSMISSION_USERNAME` / `TRANSMISSION_PASSWORD`, `HA_TOKEN`, `TS_API_KEY`, and the per-provider `ai-quota` keys. `${ENV_VAR}` interpolation in YAML covers the rest.

## Widgets

**Config-only** (no network): `bookmarks` · `search` (with bangs) · `clock` · `calendar` · `todo` · `iframe` · `html` — plus `timer` and `notepad`, documented below.

**Containers**: `group` (tabbed) · `split-column` (2 or more children side by side, `max-columns` caps the row at 2 or more tracks)

| Data widget | What it does | Source / notes |
| --- | --- | --- |
| `rss` | Items from multiple feeds | RSS/Atom via `Bun.XML`; per-feed custom headers |
| `hacker-news` | Front-page stories | Official Firebase API (`top` / `new` / `best`) |
| `reddit` | Subreddit posts or search | Reddit JSON API; OAuth client credentials supported |
| `releases` | Latest releases of tracked projects | GitHub, GitLab, Codeberg, Docker Hub |
| `weather` | Conditions + 7-day forecast | [open-meteo](https://open-meteo.com); no API key |
| `videos` | Latest videos from channels / playlists | YouTube RSS (`channel_id`, `@handle`, playlist); Shorts filtered unless `include-shorts` |
| `markets` | Quotes + sparklines | Yahoo Finance |
| `monitor` | HTTP health checks | Per-site `check-url`, `error-url`, timeouts, basic auth, alt status codes; optional Uptime Kuma (`kuma-url` + `kuma-slug`) and Healthchecks (`healthchecks-key`, `healthchecks-tags`) sources merged into the same list |
| `custom-api` | Items mapped from any JSON endpoint | JSONPath field mapping; `subrequests: {name: {url, …}}` fans several endpoints into one list (reached as `$.<name>.<field>` when no top-level `url` is set) |
| `repository` | Repo stats + open PRs / issues | GitHub REST API |
| `lobsters` | lobste.rs stories | Configurable instance |
| `server-stats` | Health of configured local services | `systeminformation` probes; defaults to one local server |
| `system-stats` | CPU / GPU / RAM / disk of the host | `systeminformation`; 1s server cache when present |
| `dns-stats` | DNS server query stats | Pi-hole (v6 session auth, v5 token fallback) or Technitium |
| `docker-containers` | Container status | Docker Engine API over unix socket |
| `ai-quota` | AI provider quota and balance | 70 known provider ids, all with fetchers, ported from [CodexBar](https://github.com/steipete/CodexBar): Codex / Claude / OpenAI / Copilot / OpenCode / Gemini / Vertex / Grok and the table-driven rows. `token` or `tokenFile` is required; shows `used%`, reset countdown, plan and balance. Default `cache` is 1h — raise the rate with `cache: 2m` |
| `model-endpoints` | Whether the models you depend on are still being served | OpenRouter per-model endpoints, free and keyless: `models[]` (required `vendor/model` slugs, 1–12), `provider` tag, `limit` rows (8), `unhealthy-only`. Worst-status-first, grouped by model, with 5m / 30m / 1d uptime. Availability, not quota — `ai-quota` covers the quota windows |
| `tailscale` | Tailnet devices, online first | Tailscale API v2 `/devices`; `api-key` (`${TS_API_KEY}`, scope `devices:core:read`), `tailnet` (`-` = the key's own tailnet), `limit` ≤ 200 (20); exit-node badges, last-seen on offline rows |
| `home-assistant` | Current state of chosen Home Assistant entities | One REST `GET /api/states` per refresh, filtered server-side to `entities[]` (required; bare id or `{entity, label}`); `url` (default `http://homeassistant.local:8123`), `token` or `HA_TOKEN`. **State only** — the present value of each entity, no history: no energy chart, no long-term statistics (those need HA's WebSocket recorder API, not REST) |
| `events-calendar` | Upcoming events from ICS feeds | `urls[]` / `ics-url` (at least one required); `days` (14), `limit` (20) |
| `weather-radar` | Animated precipitation radar | RainViewer tiles centered on `location`; `zoom` 3–10 (7) |
| `github-trending` | Trending GitHub repositories | `language`, `since` daily / weekly / monthly, `limit` ≤ 25 (10) |
| `contribution-graph` | GitHub contribution heatmap | `username` (required), optional `token`, `limit` weeks 1–104 (52) |
| `network` | Local network + public IP at a glance | `ping-target` (1.1.1.1), `public-ip` (true) |
| `change-detection` | Watched URLs with change badges | `urls[]` (required, ≤ 10), `selector` tag / `#id` / `.class` |
| `twitch-channels` | Live status of followed Twitch channels | `channels[]` (required logins), `sort-by` viewers / live, `collapse-after` (5); needs `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` |
| `twitch-top-games` | Twitch categories ranked by viewers | `limit` ≤ 25 (10), `collapse-after` (5), `exclude[]` category slugs; needs `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` |
| `immich` | Recently added photos | `url` (required), `api-key` or `IMMICH_API_KEY`, `limit` (10) |
| `jellyfin` | Recently added movies / episodes | `url` (required), `api-key` or `JELLYFIN_API_KEY`, `user-id` auto-resolved, `limit` (10) |
| `qbittorrent` | Torrent status with progress bars | `url` (required), `username` / `password` or `QBITTORRENT_USERNAME` / `QBITTORRENT_PASSWORD`, `limit` (10) |
| `transmission` | Torrent status with progress bars | `url` (required), `username` / `password` or `TRANSMISSION_USERNAME` / `TRANSMISSION_PASSWORD`, `limit` (10) |
| `timer` | Circular countdown + stopwatch + notes | Config-only; `duration: 25m` / `mm:ss`, editable ring, `notes: true` for the scratch area; persists per `id` |
| `notepad` | Minimal sticky textbox | Config-only; `placeholder`, persists per `id` to `localStorage` |

Unauthenticated GitHub and Reddit requests are rate-limited, so raise `cache` for those widgets if you hit limits.

## Theming

- **Single theme**: [astryx-dracula](https://github.com/yuzu-octopus/astryx-dracula) (`^0.2.1`, MIT) is a runtime dependency, imported as `astryx-dracula/tokens.css` + `astryx-dracula/theme.css` and applied by `<Theme theme={astryxDraculaTheme} mode="dark">`. It is **dark-only** — Dracula dark is the brand, not a mode.
- **Nothing to switch**: no presets, no light mode, no picker. The Settings dialog has two sections, About and Docs, and no appearance controls. Display mode is hardcoded; nothing about the theme is persisted to `localStorage`.
- **Custom CSS**: a top-level `custom-css-file: ./custom.css` (path relative to `config.yml`'s directory) is served with the theme and injected last so it wins. This is the only supported appearance override.
- **No config theme block**: a `theme:` key is a validation error (`config.theme: block removed …`). Delete it; hoist a custom stylesheet to `custom-css-file:`. Run `bun run check-config` to confirm.

> [!TIP]
> First paint is covered by a constant background/text pair inlined in `index.html`, so there is no light flash and no restore script to run.

## Credits

- **[astryx-dracula](https://github.com/yuzu-octopus/astryx-dracula)** — the pure Dracula brand theme for Astryx, by Yuzu Octopus. MIT. Ships the tokens, chart palette, and syntax theme Glimpse renders with.
- **[Astryx Design System](https://github.com/facebook/astryx)** — created by the Astryx team at Meta Platforms, Inc.; MIT.
- **[Dracula Theme](https://draculatheme.com)** — the color palette and specification are by Zeno Rocha and the Dracula Theme community.

## Architecture

```
┌────────────────────────── Browser ──────────────────────────┐
│  React 19 SPA (Vite) · Astryx · PWA service worker          │
│  lazy widget chunks · astryx-dracula theme · SWR hooks      │
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
  Docker Hub · open-meteo · RainViewer · Yahoo Finance · YouTube RSS · lobste.rs
  Twitch Helix · Immich · Jellyfin · qBittorrent · Transmission
  Uptime Kuma · Healthchecks · ICS feeds · watched URLs
  Pi-hole / Technitium · Docker Engine socket · any custom-api endpoint
```

`src/shared/` holds the zod config schemas and is imported by both sides, so client and server can never drift apart on the config contract. In development Vite (`:5173`) proxies `/api` to the Bun server (`:3000`); in production one process serves both.

## Known deviations from glance

- `custom-api` maps fields via JSONPath, not Go `html/template`.
- `icon:` shorthand resolution (`si:`, `di:`, `mdi:`, `sh:`, and the `auto-invert ` prefix) works on `bookmarks` links. glance also accepts `icon:` per `monitor` site and a `glance.icon` Docker label; Glimpse does not.
- **No light mode, custom themes, or theme picker** — Glimpse has one dark theme (`astryx-dracula`); the `theme:` config block is rejected.
- `todo` persists in browser localStorage only (per-browser, not shared).
- Authentication and brute-force lockout are not implemented.
- Not ported: `extension`, `calendar-legacy`. Every other glance widget type has a Glimpse equivalent.
- `${secret:}` Docker-secrets syntax is unsupported.

## Development

```bash
bun run test        # vitest (jsdom); schema + fetcher + component tests per widget, no network
bun run test:watch
bunx tsc --noEmit   # strict typecheck gate
bunx react-doctor@latest   # React quality scan (full scan is the gate)
```

Each widget ships three files — a shared zod schema, a server fetcher (data widgets), and a client component — joined by typed registries. Layout: `src/client/` (SPA), `src/server/` (Bun API), `src/shared/` (contracts used by both). See [AGENTS.md](AGENTS.md) for the full command list, architecture notes, and the widget checklist.

---

Inspired by [glanceapp/glance](https://github.com/glanceapp/glance) · themed with [astryx-dracula](https://github.com/yuzu-octopus/astryx-dracula) on [Astryx](https://github.com/facebook/astryx) · MIT — see [LICENSE](LICENSE).
