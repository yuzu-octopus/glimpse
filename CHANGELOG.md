All notable changes to Glimpse are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Keep this file current: every user-visible change gets an entry under
     Unreleased (or the next version heading) in the same commit that ships it.
     The Settings → Changelog section renders this file at build time via a
     Vite ?raw import, so no runtime fetch or markdown dependency is involved. -->

## [Unreleased]

### Added
- `model-releases` widget: live AI model drop feed from `live.aitracker.bot` with lab badges, announcement links, descriptions, and relative timestamps (`vertical-list` and `compact` styles).
- `speedtest` widget: interactive manual speed test powered by local `speedtest-cli` with an authentic 240° circular SVG speedometer gauge, live animated needle, digital speed readout, download/upload/ping metrics, and ISP/server details.
- Streaming speedtest endpoint (`POST /api/speedtest/run`) emitting live progress chunks over NDJSON.

### Changed
- Upgraded `astryx-dracula` upstream theme to 0.5.1.
- Updated dependencies (`react` 19.3.0, `@astryxdesign/core` 0.6.6, `zod` 4.6.5, `lucide-react` 1.53.0, `systeminformation` 5.33.15, `react-router-dom` 7.18.4) and dev tools.
- Cleaned up non-null assertions across client hooks, tests, and scripts; Biome exits 0 with 0 errors.

### Fixed
- Suppressed nested dark background box on links during mouse-down/active hold (`a:active`, `a[data-astryx-press]`).
- Centered row separator lines with equal spacing above and below across feed, releases, markets, monitor, custom-api, docker, home-assistant, and tailscale widgets; eliminated hover box touching top separators.

## [0.4.1] - 2026-10-07

### Fixed
- Zero biome errors: hoisted assign-in-conditions, braced forEach callbacks,
  header guards, hex-escape control regex; decorative svgs hidden, group divs
  are sections, chart bars are real buttons, autofocus via ref+effect.
- react-doctor back to 100/100 (autofocus effect dep).

## [0.4.0] - 2026-10-07

### Added
- 52 behavior-pinning tests (null-poster/url/eta states, empty/long/special
  inputs); dedupe semantics pinned (skip-identical/emit-different).

### Fixed
- Render-skip dedupe is O(1) version counter + content compare (was O(N^2)
  stringify per chunk); widgetKeysFor/ColumnGrid memoized.
- TtlCache single-map (stale-on-error preserved).

### Removed
- engagement.ts, HideHeadersContext, fmtNumber micro-files inlined (-12 lines).

## [0.3.0] - 2026-10-07

### Fixed
- YouTube widgets interleave channels (per-source cap) instead of one
  prolific channel filling all slots; grid-cards white-at-rest with
  purple on hover, compact rows keep purple at rest.
- Hover doctrine app-wide is wash-only: title lifts that painted white
  on the light wash are gone; every tappable row gets the same overlay
  wash + radius, static rows none.

### Changed
- Server file reads go through Bun.file (node:fs/promises fallbacks
  dropped); token spawn gets a 10s timeout.

## [0.2.1] - 2026-10-06

### Added
- Changelog renders colourised Markdown (headings/code/links/quotes mapped
  onto dracula tokens, single title, no leaked maintainer comment).
- Radar frame time shows the radar's own timezone, not UTC.

### Fixed
- Every clickable title wears tappable purple at rest (videos, bookmarks,
  media, repository, reddit, docker names).

## [0.2.0] - 2026-10-06

### Added
- Settings gains a Changelog section rendering this file; About refetches on
  every open so version + config path never go stale.
- system-stats: battery, uptime, 1m load, fan RPM, GPU load natively
  (sidecar retireable); `show-all-mounts` opt-in for multi-disk boxes.
- videos: playlist-grid channels resolve via playlist listing (max 3).
- videos config leads with `@handle`; raw `UC...` documented as stable alt.

### Fixed
- Feed/docket hover wash is rounded with a first-row gap (was sharp, flush).
- Radar centers on the location via nearest-corner anchoring (floor anchor
  pinned every location to the corner — the f7941dd math cancelled fx).
- Machine rows align in a table grid; disks default to root-only, pseudo
  mounts filtered; narrow tiles get a 220px two-column query.
- Network/market rows no longer crush in narrow tiles (responsive audit:
  laptop/tablet/phone all checked, desktop pixel-identical).

## [0.1.1] - 2026-10-06

### Fixed
- Bind the server to `127.0.0.1` by default so the dashboard is not exposed on
  every interface; `GLIMPSE_HOST` overrides it for behind-firewall debugging
  (de9e6a0).
- RSS: strip HTML tags from descriptions server-side.
- Feed rows: hover wash clears glyphs; calendar today fills its cell;
  uncolored bookmark titles neutral, not purple.
- system-stats absorbs sidecar readings; disks deduped; row truncation fixed.
- Tailscale rows show short hostnames.
- videos resolves playlist-grid channels.
- Radar centers the map on the location (first attempt — superseded in 0.2.0).
