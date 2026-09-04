# Glimpse Improvement Plans — audit 2026-09-04

Base commit: `e2c784d`. Status: PROPOSED — no executor runs until user approves.

Decisions locked: evolve (not remake) · own visual identity (internal consistency, not glance clone) · desktop-first responsive (tablet + mobile must be nice, desktop priority) · tiling/skeleton redesign via research first · samples updated with every component/default change.

## Order

| # | Plan | Depends on | Status |
|---|------|-----------|--------|
| 001 | Simplify core (quota table, palette unify, PREF co-locate) | — | TODO |
| 002 | Perf fixes (preload scope, per-widget poll, warmup cap, TTL align, fonts/memo) | 001 | TODO |
| 003 | Widget DX (generator, single registry, validate CLI, line-number errors) | 001 | TODO |
| 004 | Docs refresh (counts, tables, SKILL, AGENTS, examples for all 32) | 003 | TODO |
| 005 | Tiling research (bento/collage/skeleton, single placement module design) | — | TODO |
| 006 | Tiling + skeleton redesign (implements 005; updates samples; desktop-first responsive) | 005 | TODO |
| 007 | New widgets shortlist (twitch, change-detection, uptime-kuma, media stack) | 003, 006 | TODO |

002 and 003 run parallel after 001. 004 after 003 (generator defines canonical widget shape). 006 after 005. 007 after 003 + 006.

## Rejected (vetted, do not re-audit)

- Delete hand-rolled SWR, react-router, systeminformation, retry machinery — keep (see 001).
- Full glance visual clone — own identity instead; consistency pass only.
- skill://astryx as API truth — invented API; `node_modules/@astryxdesign/core/dist/**/*.d.ts` is truth. Astryx usage fully compliant, no action.
- Settled per specs: tiling superset, show-less non-sticky, skeleton-vs-spinner, multiplier ignore, twitch removal rationale.
