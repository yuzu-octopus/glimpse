# YouTube data fetching without a Data API key — what actually works in 2026-27

**Date:** 2026-09-27
**Depth:** deep

## Question
For a keyless, dependency-light Bun/TypeScript dashboard widget that lists a channel's or
playlists' recent videos, which retrieval strategies still work in 2026-27, which are dead
or token-gated, and what is the recommended chain with an explicit fragility ceiling?

## Decision
Whether to keep the current chain (handle scrape -> `feeds/videos.xml?channel_id=` ->
`ytInitialData` /videos scrape) or change it: add InnerTube, adopt an npm library, add a
playlist fallback, or change what counts as a hard failure.

## Answer form
Comparison table (strategy x alive/dead, keyless?, scrape?, fragility) + a concrete
recommended request chain for a Bun server-side fetcher, with a named fragility ceiling and
a loud-failure policy.

## Scope
**In:** `youtube.com/feeds/videos.xml` (channel + playlist), handle->channelId resolution,
InnerTube `youtubei/v1/*` client contexts, yt-dlp / pytubefix / youtube-dl-exec /
innertube scrapers, Piped / Invidious instances, RSS-bridge services, unauthenticated
subscription feeds, JS/Bun npm libraries.
**Out:** Data API v3 with a key (only to contrast), video playback/decryption, SEO
ranking, anything requiring us to run a browser.

## Assumptions (written, not blocking)
- The implementer works in parallel and does not wait on this report; research must not
  assume any implementation change.
- "Works" means: works from a datacenter/VPS IP with no Google account, no cookies, no
  proxy rotation, no Data API key, and no PO token. Anything requiring those is out of the
  "keyless" bucket even if it is broadly used.
- We are Bun + TypeScript strict, Zod v4, and refuse a new heavy dependency. A library
  recommendation must be weighed against hand-parsing.
- Claims about "2026" behaviour must be dated; a 2023 blog post about InnerTube is evidence
  of history, not of today's behaviour.

## Angles
1. **F1 — `feeds/videos.xml` channel feed**: current reliability, 404/empty cases, why
   (channel property vs 2025/2026 change vs region), official/primary statements, workarounds.
2. **F2 — Non-key retrieval tooling 2026-27**: yt-dlp, pytubefix, youtube-dl-exec, innertube
   clients, Newspaper-style scrapers — alive? keyless? scrape? fragility. Versions + dates.
3. **F3 — InnerTube API**: has `youtubei/v1/player|browse|search` changed? PO token /
   attestation requirements, which client contexts still return `channelId` for a handle
   without a token. Exact context name + version. This is the highest-value angle.
4. **F4 — Aggregator/bridge layer**: Piped + Invidious instances live in 2026-27, public
   instance health, RSS bridges; plus the merged-subscription problem and the state of the
   `UU`/`PL`/`feed_id` RSS tricks.
5. **F5 — Playlist feeds + library survey**: does `feeds/videos.xml?playlist_id=` still work,
   does it have the same 404 problem, plus npm JS/Bun library survey (maintained vs abandoned).
6. **F6 — Failure-mode / counter-angle**: practitioners' reports of what broke and when
   (GitHub issues, yt-dlp issue tracker, self-hosted dashboard projects) — vendor-published
   success is over-represented, so this angle is mandatory.

## Evidence rules
Primary sources only: YouTube/Google official docs & help pages, source code and issue
trackers of the tools themselves, official npm registry metadata, instance health pages.
Secondary (blogs) only where primary is genuinely absent, tagged `[secondary]`. Every
number gets a URL. Unverifiable -> "unverified", never inferred.
