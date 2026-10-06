# Changelog

All notable changes to Glimpse are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Keep this file current: every user-visible change gets an entry under
     Unreleased (or the next version heading) in the same commit that ships it.
     The Settings → Changelog section renders this file at build time via a
     Vite ?raw import, so no runtime fetch or markdown dependency is involved. -->

## [Unreleased]

## [0.1.1] - 2026-10-06

### Fixed
- Bind the server to `127.0.0.1` by default so the dashboard is not exposed on
  every interface; `GLIMPSE_HOST` overrides it for behind-firewall debugging
  (de9e6a0).
- RSS: strip HTML tags from summaries so markup no longer leaks into cards.
- Feed, calendar and bookmark widgets: consistent card spacing and overflow
  handling.
- System-stats: read native OS metrics instead of shelling out.
- Tailscale: show short hostnames instead of full DNS names.
- Videos: fall back to the playlist view when the primary source fails.
- Radar: center on the user's location by default.

### Changed
- Version bumped to 0.1.1.
