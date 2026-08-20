# Glimpse — Dashboard Component Brainstorm
Read-only research. 12 proposals across 5 categories. No code edits.

## Existing Widgets (22 types)
Source: src/shared/widgets/index.ts + src/client/widgets/* + config.example.yml
- bookmarks, search, clock, calendar, todo, iframe, html, rss, hacker-news, reddit, lobsters, releases, weather, videos, markets, monitor, custom-api, repository, twitch-channels, twitch-top-games, group, split-column
- Layout: pages -> head-widgets + columns (small=300px, full) + tiling:collage + hide-headers
- Coverage: feeds (RSS/HN/Reddit/Lobsters/Releases/Videos) + homelab-lite (monitor) + productivity-lite + finance-lite + dev-lite + extensibility (custom-api/iframe)
- Gaps vs Glance: server-stats, docker-containers, dns-stats, changedetection, richer homelab/media, no sparkline/bento/heatmap

## Stealable Layouts
1. Bento Grid (shadcn/ui dashboard-01 + shadcn-ui-blocks) — asymmetric CSS Grid, span-2 cards, 1px border. Fits Glimpse flat style.
2. Sparkline KPI Cards (Tremor + Recharts) — value + delta badge + 40px mini line without axes. For markets + server-stats.
3. Calendar Heatmap (Nivo -> ECharts) — 5-step palette, square cells, tooltip. For habits, GitHub activity, DNS queries. Nivo small, ECharts large.

## Proposals — 12 ideas
### Productivity/Utility
1. Focus Timer + Habit Streak — Pomodoro + habit heatmap — LocalStorage/todo API — New — low
2. Unified Inbox Digest — unread counts + subjects — Gmail/Outlook/IMAP — New/Homepage parity — medium
3. Scratch Notes — autosave textarea markdown — LocalStorage/custom-api — New — low
### Dev/Code
4. CI Pipeline (GitHub Actions) — workflow status dots + duration — GitHub Actions API — Glance ext — medium
5. Docker Containers — name/status/uptime/sparkline — Docker Engine API — Glance parity — medium
6. Server Stats + Uptime Sparkline — CPU/RAM/disk + 24h sparkline — Node exporter/Beszel/Glances — Glance parity — medium
### Homelab/Infra
7. DNS Stats (Pi-hole/AdGuard) — queries/blocked/top domains — Pi-hole/AdGuard API — Glance parity — low
8. Media Stack (Jellyfin/Plex/Immich) — recently added + active streams — Jellyfin/Plex/Immich API — Community parity — medium
9. ChangeDetection Watcher — watched URLs + diff age — ChangeDetection.io API — Glance parity — low
### Finance
10. Markets+ Sparklines & Holdings — price + 7d sparkline + holdings — Yahoo Finance chart — Enhance existing — low
### Fun/Lifestyle
11. APOD + Quote Bento — hero image + quote + mini calendar — NASA APOD + quotable.io — Community parity — low
12. Scoreboard (Sports/F1/UFC) — live/final scores + countdown — ESPN/F1/UFC API — Community parity — medium

Priority: DNS Stats > Markets+ > Server Stats > Docker > CI > ChangeDetection
