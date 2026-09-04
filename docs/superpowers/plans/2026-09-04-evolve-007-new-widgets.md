# 007 — New Widgets Shortlist

Base: `e2c784d`. Depends on 003 + 006. Status: TODO.

## Why

Glance parity gaps + high-value new. Build on generator (003) and new geometry (006) so widgets ship consistent.

## Candidates (confirm order before executing)

1. `twitch-channels` + `twitch-top-games` (OAuth; biggest parity gap).
2. `change-detection` (watched-URL diff; homelab fit).
3. Uptime source (uptime-kuma/healthchecks) for monitor.
4. Media stack (immich/jellyfin recently-added, qbittorrent/transmission).
5. `extension` equivalent only if custom-api can't cover (defer by default).

Each widget: schema + fetcher + renderer + 3 tests + example + docs row (per 003 generator). One widget per task, parallel agents, integration pass (tsc/test/doctor) at end.

Out: tiling changes, core refactors.

## Done

Approved widgets shipped, exemplified, documented; gates green. Unapproved candidates stay out.
