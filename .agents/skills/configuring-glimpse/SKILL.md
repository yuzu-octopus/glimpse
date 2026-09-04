---
name: configuring-glimpse
description: Use when writing or editing a Glimpse config.yml — adding pages, columns, widgets, head-widgets, environment variable interpolation, $include merges, theme blocks, or diagnosing zod validation errors from bad YAML
---

# Configuring Glimpse

## Overview
Glimpse dashboards are defined entirely in `config.yml` (glance-compatible format), validated by zod at load. Wrong shape = readable validation error naming the JSON path; on auto-reload failure the last good config stays active.

## Structure rules (enforced, not advisory)
```yaml
pages:
  - name: Home            # slug = slugify(name); must be unique
    width: default        # default | slim | wide
    columns:              # OR flat `widgets:` (pure bento) — never both
      - span: 3           # span tracks on 12-col grid; legacy size: small/full still accepted
        widgets:
          - type: clock
    head-widgets:         # optional row above columns
      - type: search
```
Max 3 columns/page, columns require `size` or `span` (span explicit on all or none); when using `size`, exactly 1–2 `full`. Groups cannot nest `group`/`split-column`.

## Shared widget props
| Prop | Notes |
|---|---|
| `title`, `title-url` | header text + click target |
| `hide-header: true` | page-level `hide-headers: true` forces it everywhere |
| `cache` | `\d+[smhd]` e.g. `12h`; default 5m |
| `css-class` | extra class on the card |

## Widget options cheat sheet
| Widget | Key options |
|---|---|
| `rss` | `feeds[].url/title`, limit, collapse-after, style |
| `hacker-news` | sort `top/new/best`, limit, collapse-after |
| `reddit` | `subreddit`, sort, `search` mode |
| `releases` | `repositories[]`: `"owner/repo"` or gitlab:/codeberg:/dockerhub: prefixed, or `{repository, include-prereleases}`; optional per-repo `token` / `gitlab-token` |
| `lobsters` | `instance-url` (default lobste.rs), `custom-url`, sort `hot/new`, `tags[]`, limit, collapse-after |
| `repository` | `repository: owner/repo`, `pull-requests-limit` / `issues-limit` (5), `token` |
| `videos` | `channels[]` (UC id or @handle), `playlists[]` (`playlist:<id>`), include-shorts |
| `twitch-channels` | `channels[]` (required logins), `sort-by` viewers\|live, collapse-after (5); needs `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` |
| `twitch-top-games` | `limit` ≤25 (10), collapse-after (5), `exclude[]` slugs; needs `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` |
| `markets` | `markets[]`: {symbol (`SPY`, `BTC-USD`), name?, symbol-link?, chart-link?}, sort-by |
| `monitor` | `sites[]`: url, check-url, error-url, timeout (`3s`), alt-status-codes, basic-auth, same-tab |
| `custom-api` | `url`, method, headers/body, `options[]` JSONPath mappings |
| `weather` | `location`, units metric\|imperial, hide-location |
| `weather-radar` | `location` (required), `zoom` 3–10 (7) |
| `github-trending` | `language`, `since` daily\|weekly\|monthly, limit ≤25 |
| `contribution-graph` | `username` (required), `token`, `limit` weeks 1–104 (52) |
| `network` | `ping-target`, `public-ip` |
| `events-calendar` | `urls[]` / `ics-url` (one required), `days` (14), `limit` (20) |
| `server-stats` | `servers[]`: {name?, type: local(default) \| remote, url?} |
| `system-stats` | none required (host machine) |
| `dns-stats` | `service`: pihole \| adguard \| technitium, `url`, credentials |
| `docker-containers` | `sock-path` (default `/var/run/docker.sock`; tcp:// or http:// URL also works) |
| `bookmarks` | `groups[]`: {title, links[]} |
| `search` | `search-engine` (preset name / URL / {name,url}), `bangs[]`, new-tab (default true), target |
| `clock` | `timezones[]` {timezone, label}, hour-format 24h\|12h |
| `calendar` | first-day-of-week |
| `timer` | `id`, `duration: 25m` / `mm:ss` (user-editable), `notes: true` |
| `notepad` | `id`, `placeholder` |
| `group` | tabbed container; `widgets[]` (≥1; cannot nest `group`/`split-column`) |
| `split-column` | side-by-side container; `widgets[]` (exactly 2; cannot nest `group`/`split-column`) |
| `todo` / `iframe` / `html` | id / source+height / raw content |
| `ai-quota` | `provider` (70 ids: codex/claude/openai/anthropic/copilot/gemini/cursor/kimi/opencode/vertex/jetbrains/zed/grok/amp/kiro/antigravity/ollama/bedrock/stepfun/… — `KNOWN_PROVIDERS` in `src/shared/widgets/quota-types.ts`), `token` (env `${VAR}`) or `tokenFile` (mounted path: JetBrains `AIAssistantQuotaManager2.xml`, Kiro `kiro-cli` auth file, Grok `~/.grok/auth.json`, Zed `~/.config/zed/credentials`, Amp `~/.config/amp/auth.json`), `quotaUrl` override (e.g. `Z_AI_API_HOST`, Ollama `http://localhost:11434`, Antigravity `https://localhost:8765`), `projectId` (OpenAI/Vertex/GCP), `baseUrl`, `cache` (`2m` default, `5m` for file/CLI) |

Authoritative shapes: `src/shared/widgets/*.ts` (schema per widget) and working examples in `config.example.yml`.

## Variables & includes
- `${VAR}` interpolates from process env into any string; **missing var is a validation error** at startup. `${secret:…}` is NOT supported.
- `$include: ./more.yml` (string or list; absolute paths OK) — relative to the including file, recursive with no depth limit; pages append (parent first, then includes in order), theme keys merge with the include winning; non-string entries are validation errors; diamonds are included once, true cycles rejected with `circular $include detected`.
- Config auto-reloads on save; watch out: cache keys reset on reload.

## Theming (quick form)
```yaml
theme:
  background-color: 256 22 10   # glance format: "H S L" space-separated ints (% optional)
  primary-color: 262 83 58
  positive-color: 142 60 45
  negative-color: 0 70 55
  custom-css-file: ./custom.css # relative to config.yml's directory
```
Preset ids live in `src/shared/theme/presets.ts` (e.g. `catppuccin-mocha` is the default dark). Preset choice and light/dark mode are picked in the nav settings panel (persisted per-browser) — NOT settable in config.yml; `theme.light` only chooses which side of a preset pair receives the color overrides. `contrast-multiplier`/`text-saturation-multiplier` parse but do nothing.

## Common mistakes
- Commas in HSL (`262, 83, 58`) → validation error. Space-separated only: `262 83 58` (percent signs are optional).
- Mixing explicit spans on some columns only → error (all-or-none).
- Putting `group` inside `group` → error.
- Expecting `.env` loading — there is none; export vars or use your process manager.
