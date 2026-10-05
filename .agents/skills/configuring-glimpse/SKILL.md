---
name: configuring-glimpse
description: Use when writing or editing a Glimpse config.yml — adding pages, columns, widgets, head-widgets, environment variable interpolation, $include merges, custom-css-file, or diagnosing zod validation errors from bad YAML
---

# Configuring Glimpse

## Overview
Glimpse dashboards are defined entirely in `config.yml` (glance-compatible format), validated by zod at load. Wrong shape = readable validation error naming the JSON path; on auto-reload failure the last good config stays active.

## Structure rules (enforced, not advisory)
```yaml
pages:
  - name: Home            # slug = slugify(name); must be unique
    width: default        # default | slim | wide
    columns:              # or a flat `widgets:` list (pure bento); both together is accepted, and the flat list wins
      - span: 3           # span tracks on 12-col grid; legacy size: small/full still accepted
        title: Clock         # optional: names the column itself; the mobile section header reads it
        widgets:
          - type: clock
    head-widgets:         # optional row above columns
      - type: search
```
Max 3 columns/page, and every column needs `size` or `span`. With `size`, exactly 1–2 columns must be `full`; when every column carries an explicit `span` the grid is sized outright and the full/small rule is skipped. `span` on some columns but not others is rejected — as `must have at least one full column`, not a span-specific message, because a mixed page falls through to the `size` rules.

A page needs `columns:` or `widgets:`. Supplying **both** is not an error — the schema only complains when neither is present — and at render the flat `widgets:` list wins, leaving `columns:` unused.

Group nesting is enforced in exactly one place: the direct children of a `group`, under `columns[].widgets` or `head-widgets`. There, a `group` or `split-column` child is an error. Nothing else is walked — a `split-column`'s children are never inspected, and a page's flat `widgets:` list is not scanned for nesting at all, so the same nesting that is rejected under `columns:` loads clean under `widgets:`.

Without a column `title` the mobile section header falls back to the column's first widget title, then `Column N`.

## A key that isn't in the schema is stripped, not rejected
Widget objects are plain `z.object`, so a key the schema doesn't declare parses clean and is then dropped — no validation error, nothing logged at runtime, the widget simply renders as if you hadn't written it. `sort:` where the schema says `sort-by:` is the textbook case, and so is any `token:` Glimpse moved to the environment.

`bun run check-config` is the only thing that catches it: it diffs the raw YAML against the schemas and prints
```
warning: line 12: "sort" is not a supported option of the hacker-news widget (pages[0].columns[0].widgets[0].sort) — Glimpse ignores it
```
Those are warnings, not errors — they print on a passing run too, so a config with a typo still exits 0. Read the output, not just the exit code. A credential Glimpse used to read from config gets its own line naming the env var to set instead. Two gaps worth knowing: the config root is exempt (glance declares ~38 top-level keys, Glimpse admits 2), and `.loose()` widgets — `network`, `system-stats`, `server-stats`, `docker-containers`, `github-trending`, `change-detection`, `model-endpoints`, `twitch-channels`, `twitch-top-games` — keep unknown keys instead of stripping them, so nothing is ever reported there.

## Shared widget props
Every widget accepts all of these — no widget-specific opt-in needed.
| Prop | Default | Notes |
|---|---|---|
| `title`, `title-url` | — | header text + click target |
| `hide-header: true` | — | page-level `hide-headers: true` forces it everywhere |
| `cache` | per widget type | `\d+[smhd]` e.g. `12h`. Unset: 1s for `server-stats` / `system-stats`, 10m for `weather-radar`, 60s for the six live types, 1h for everything else — so a state widget you want fresh needs an explicit `cache: 60s` |
| `css-class` | — | extra class on the card |
| `retries` | `3` | extra fetch attempts **after** the first, 0–10. `0` = try once, never retry. Raise it for flaky upstreams; lower it so a dead endpoint fails fast instead of stalling the poll. |
| `show-errors` | `true` | `false` renders a failed widget quietly — no error banner, no red chrome, just the card and whatever content it still has. The status dot beside the title keeps reporting the failure, so quiet is never invisible. |

Also inherited: `priority`, `span`, `zone` — pure bento hints, used when a page lists `widgets:` flat and ignored in `columns:` mode.

Only the six live types (`clock`, `weather`, `markets`, `monitor`, `server-stats`, `system-stats`) also poll themselves — 1s on a page containing `server-stats` / `system-stats`, 30s otherwise. Every other widget re-reads on tab focus, route change, or reload, and the server then serves its own cache until that TTL expires. A `home-assistant` or `tailscale` card on a page with no live widget will look frozen for up to an hour until you set `cache`.

### Glance type aliases
`to-do` loads as `todo` and `stocks` as `markets`, at any nesting depth including inside `group` / `split-column`. Canonical names in docs, error messages, and every registry stay `todo` and `markets`. `bun run check-config` accepts both spellings.

## Widget options cheat sheet
| Widget | Key options |
|---|---|
| `rss` | `feeds[].url/title`, limit, collapse-after, style |
| `hacker-news` | `sort-by` top\|new\|best, limit, collapse-after |
| `reddit` | `subreddit` (required), `sort-by` hot\|new\|top\|rising, `search`, `top-period`. No `app-auth` — `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` in the environment switch the widget to the OAuth host |
| `releases` | `repositories[]`: `"owner/repo"` or `gitlab:`/`codeberg:`/`dockerhub:`-prefixed, or `{url?, repository?, source?, include-prereleases?}`; limit, collapse-after. **No per-repo `token`/`gitlab-token`** — those keys are stripped. Credentials come from the environment only (`GITHUB_TOKEN`, or `GH_TOKEN`, and `GITLAB_TOKEN`); without them these endpoints are read anonymously |
| `lobsters` | `sort-by` hot\|new, `tags[]`, limit, collapse-after, `instance-url` (default lobste.rs, giving `<instance>/hottest\|newest.json`) — `custom-url` replaces the whole URL when set |
| `repository` | `repository: owner/repo` (required), `pull-requests-limit` / `issues-limit` (5), `commits-limit` (-1 = show none, glance's default). **No `token`** — `GITHUB_TOKEN`/`GH_TOKEN` in the environment only, else the public API's anonymous rate limit |
| `videos` | `channels[]` (UC id or @handle), `playlists[]` (`playlist:<id>`), include-shorts |
| `twitch-channels` | `channels[]` (required logins), `sort-by` viewers\|live (viewers), collapse-after (5); needs `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` |
| `twitch-top-games` | `limit` 1–25 (10), collapse-after (5), `exclude[]` slugs; needs `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` |
| `markets` | `markets[]`: {symbol (`SPY`, `BTC-USD`), name?, symbol-link?, chart-link?}, `sort-by` change\|absolute-change |
| `monitor` | `sites[]`: url, title?, icon?, check-url, error-url, timeout (`3s`), alt-status-codes, expected-status-code, basic-auth, same-tab, allow-insecure — or instead of sites, `kuma-url` + `kuma-slug` (both together or neither) or `healthchecks-url`/`healthchecks-key` (`healthchecks-tags` needs one of those two). At least one of the three sources must be set |
| `custom-api` | `url` **or** at least one `subrequests` entry (at least one is required). Request fields: `method` (GET/POST/PUT/PATCH/DELETE/OPTIONS/HEAD), `headers`, `body`, `body-type` (json\|string), `parameters`, `allow-insecure`, `skip-json-validation`, plus `frameless` and `limit`. `subrequests: {<name>: {url, …same request fields}}` fetches several endpoints in parallel and makes them a synthetic root keyed by name, so `options.path` reaches them as `$.<name>.<field>`. When a top-level `url` **is** set it is the root and subrequests are not merged in. `options` is a single mapping object, not a list: `path` (JSONPath, default `$`), `title`, `url`, `description`, `icon`, `subtitle`, `value`, `image`, `timestamp`; a value starting `$`/`@` is evaluated as JSONPath against the item, anything else is a literal. |
| `weather` | `location`, units metric\|imperial, hide-location |
| `weather-radar` | `location` (required), `zoom` 3–10 (7) |
| `github-trending` | `language`, `since` daily\|weekly\|monthly, limit 1–25 (10) |
| `contribution-graph` | `username` (required), `limit` weeks 1–104 (52). **No `token`** — the fetcher scrapes public profile HTML, so the widget is anonymous by construction and the key would only have put a secret in the config |
| `network` | `ping-target`, `public-ip` |
| `events-calendar` | `urls[]` / `ics-url` (one required), `days` (14), `limit` (20) |
| `change-detection` | `urls[]` (required, ≤10), `selector` tag/`#id`/`.class` |
| `immich` | `url` (required), `limit` (10). The key is environment-only (`IMMICH_API_KEY`) — there is no `api-key` key |
| `jellyfin` | `url` (required), `user-id` (auto-resolved to the first user when omitted), `limit` (10). The key is environment-only (`JELLYFIN_API_KEY`) — there is no `api-key` key |
| `qbittorrent` / `transmission` | `url` (required), `limit` (10). Credentials are environment-only — `QBITTORRENT_USERNAME`/`QBITTORRENT_PASSWORD`, `TRANSMISSION_USERNAME`/`TRANSMISSION_PASSWORD`; there are no `username`/`password` keys |
| `server-stats` | `servers[]`: {name?, type: local(default) \| remote, url?} |
| `system-stats` | none required (host machine) |
| `dns-stats` | `url` (required), `service` pihole (default) \| adguard \| technitium, `allow-insecure`, `hide-graph`, `hide-top-domains`. Credentials are environment-only, one set per service: `PIHOLE_PASSWORD`/`PIHOLE_TOKEN`, `ADGUARD_USERNAME`/`ADGUARD_PASSWORD`, `TECHNITIUM_TOKEN` — there are no `username`/`password`/`token` keys |
| `docker-containers` | `sock-path` (default `/var/run/docker.sock`; tcp:// or http:// URL also works), `running-only`, `category`, `hide-by-default` |
| `tailscale` | `tailnet` (id, or `-` for the tailnet that owns the key), `limit` 1–200 (20). The key is environment-only (`TS_API_KEY`, needing the `devices:core:read` scope) — there is no `api-key` key. Online devices sort first; exit-node badges come from `enabledRoutes` in the same one call |
| `home-assistant` | `entities[]` required, in display order — a bare entity id (`sensor.living_room_temp`) or `{entity, label}` to override the derived name; `url` (default `http://homeassistant.local:8123`). The long-lived access token is environment-only (`HA_TOKEN`) — there is no `token` key. **State only**: the current value of each entity from one REST `GET /api/states`, filtered server-side (never one request per entity). There is no history here — no energy chart, no long-term statistics; those come from HA's WebSocket recorder API, not REST, so a config asking for them wants a different tool |
| `bookmarks` | `groups[]`: {title, links[]} |
| `search` | `search-engine` (preset name / URL / {name,url}), `bangs[]`, new-tab (default true), target |
| `clock` | `timezones[]` {timezone, label}, hour-format 24h\|12h |
| `calendar` | first-day-of-week |
| `timer` | `id`, `duration: 25m` / `mm:ss` (user-editable), `notes: true` |
| `notepad` | `id`, `placeholder` |
| `group` | tabbed container; `widgets[]` (≥1). A `group` or `split-column` child is rejected — but only one level deep, and only under `columns:`/`head-widgets` (see Structure rules) |
| `split-column` | side-by-side container; `widgets[]` (≥2) laid out in a grid of at most `max-columns` tracks per row (`max-columns` ≥ 2, default 2, clamped to the child count) — N children, one column each, wrapping past the cap. Nothing validates what goes inside: nesting is only checked among a `group`'s own children |
| `todo` / `iframe` / `html` | `id` / `source` + `height` (≥50) / `source` (raw markup) |
| `ai-quota` | `provider` (70 ids, default `codex`, all with fetchers: codex/claude/openai/anthropic/copilot/gemini/cursor/kimi/opencode/vertex/jetbrains/zed/grok/amp/kiro/antigravity/ollama/bedrock/stepfun/… — `KNOWN_PROVIDERS` in `src/shared/widgets/quota-types.ts`), `tokenFile` (mounted path: JetBrains `AIAssistantQuotaManager2.xml`, Kiro `kiro-cli` auth file, Grok `~/.grok/auth.json`, Zed `~/.config/zed/credentials`, Amp `~/.config/amp/auth.json`), `quotaUrl` override (e.g. `Z_AI_API_HOST`, Ollama `http://localhost:11434`, Antigravity `https://localhost:8765`), `projectId` (OpenAI/Vertex/GCP), `baseUrl`. **No `token`** — the credential comes from the provider's own environment variable (CODEX_TOKEN, ANTHROPIC_API_KEY, …) or from `tokenFile`. Default `cache` is 1h — set `cache: 2m` for a counter you actually watch |
| `model-endpoints` | Whether the **models and providers you depend on are still being served** — availability, not your quota. `ai-quota` above is the quota/balance view; adding both is fine, but neither answers the other's question, and one being empty says nothing about the other. `models[]` required (OpenRouter `vendor/model` slugs, 1–12), `provider` tag filter, `limit` rows 1–100 (8), `unhealthy-only`. Keyless — no token, no `quotaUrl`; worst-status-first, grouped by model, 5m / 30m / 1d uptime |

Authoritative shapes: `src/shared/widgets/*.ts` (schema per widget) and working examples in `config.example.yml`.

## Worked examples
```yaml
- type: monitor            # a flaky upstream: 6 attempts, 10m cache
  title: Services
  cache: 10m
  retries: 6
  sites:
    - url: https://grafana.lab
      title: Grafana

- type: hacker-news        # a background widget: fail fast and fail quiet
  retries: 1
  show-errors: false
  limit: 8

- type: split-column       # three panes across, one row
  max-columns: 3
  widgets:
    - type: todo
      id: sc-todo
    - type: clock
    - type: notepad
      id: sc-notes

- type: custom-api        # no top-level url: subrequests become the root
  subrequests:
    uptime: { url: https://status.example.com/api/v2/summary.json }
    billing: { url: https://billing.example.com/api/plan }
  options:
    path: $.uptime.components[*]
    title: $.name
    description: $.status
```

## Variables & includes
- `${VAR}` interpolates from process env into any string; **missing var is a validation error** at startup (`${VAR:-fallback}` supplies a default). `${secret:…}` is NOT supported. Validate offline first: `bun run check-config [path]` (line numbers + did-you-mean widget types).
- `$include: ./more.yml` (string or list; absolute paths OK) — relative to the including file, recursive with no depth limit; pages append (parent first, then includes in order), `custom-css-file` merges with the last include winning; non-string entries are validation errors; diamonds are included once, true cycles rejected with `circular $include detected`. Only `pages` and `custom-css-file` merge — any other top-level key in an included file (`server:`, a stray `theme:`) is dropped with a warning rather than an error.
- Config auto-reloads on save; watch out: cache keys reset on reload.

## Theming
There is no `theme:` block. Glimpse has a single dark theme ([astryx-dracula](https://github.com/yuzu-octopus/astryx-dracula)); the only theme-adjacent key left is a top-level custom stylesheet:
```yaml
custom-css-file: ./custom.css # TOP-LEVEL key, relative to config.yml's directory
```
The valid top-level surface is exactly `pages` (required) + `custom-css-file` (optional).

## A `theme:` key is an error
Any `theme:` block — including the old HSL colors, `light`, `presets`, or a nested `custom-css-file` — is rejected with ONE issue at path `config.theme`:
```
config.theme: block removed — Glimpse now uses the astryx-dracula theme; delete the theme block from your config (if you set a custom stylesheet, move it to a top-level `custom-css-file:` key)
```
On auto-reload the last good config stays active, so a dashboard can look like it "ignored" the edit. Delete the block, hoist `custom-css-file` to the top level if you had one, then run `bun run check-config` — it prints the numbered YAML, every error with a hint, and did-you-mean suggestions for typo'd widget types, exiting 1 on failure.

`bun run check-config [path]` is the offline gate for every config edit, not just theme edits.

## Common mistakes
- Leaving a `theme:` block behind after upgrading → `config.theme` error, last good config stays active. Delete it.
- Mixing explicit spans on some columns only → error (all-or-none), reported as "must have at least one full column".
- Putting a `group` or `split-column` inside a `group` → error, but only under `columns:`/`head-widgets`; the same nesting under a flat `widgets:` page is never checked.
- Writing `sort:` where the schema says `sort-by:` → the key is stripped and the widget keeps its default order, with nothing logged at runtime.
- Writing a credential key Glimpse moved to the environment (`token`, `api-key`, `username`, `password`) → stripped as well, and the config file was the only place that secret was stored.
- Expecting `.env` loading — there is none; export vars or use your process manager.
- Setting `show-errors: false` and then wondering why a dead widget looks fine — the status dot is the only remaining signal; check it.
- Setting `retries: 0` expecting "unlimited" — it means one attempt, no retry.
- Giving `custom-api` neither `url` nor a `subrequests` entry → validation error; giving it both is legal but the subrequests are then unreachable.
- Writing `max-columns` on a `group` (tabs, not tracks) or expecting it to add children.
