# Changelog

All notable changes to Glimpse are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Keep this file current: every user-visible change gets an entry under
     Unreleased (or the next version heading) in the same commit that ships it.
     The Settings → Changelog section renders this file at build time via a
     Vite ?raw import, so no runtime fetch or markdown dependency is involved. -->

## [Unreleased]

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
