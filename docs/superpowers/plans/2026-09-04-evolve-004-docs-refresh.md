# 004 — Docs Refresh

Base: `e2c784d`. Depends on 003. Status: TODO.

## Why

Counts disagree (schema 32 / README 27 / AGENTS 22); 5 newest widgets missing from README table, SKILL cheat sheet, `config.example.yml`; deviations list stale.

## Tasks

1. Single source: derive widget count/table from schema (or update all three to 32 with same list).
2. README table: add events-calendar, weather-radar, github-trending, contribution-graph, network (+timer/notepad/ai-quota rows); refresh deviations (twitch, change-detection, extension, calendar-legacy, auth).
3. SKILL cheat sheet: add lobsters, timer, notepad, group/split-column options, repository limits, 5 new widgets; document nested-$include limits + diamond behavior.
4. AGENTS.md: fix counts, checklist file list (contribution/radar/github-trending/network/calendar), key dirs (quota/, warmup, renderers).
5. `config.example.yml`: active examples for timer, notepad, lobsters, system-stats, split-column, html, search + all five new widgets; expand ai-quota beyond 10 providers.

Out: code behavior changes.

## Done

Counts agree; every shipped widget documented + exemplified; `bun run test` green (doc tests if any). No placeholders.
