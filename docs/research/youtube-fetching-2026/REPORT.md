# YouTube data fetching without a Data API key — what actually works in 2026-27

**Answer:** Keep the RSS feed as the primary path — it is measurably the most reliable keyless
option available: a 379-channel sweep returned **HTTP 200 for 379/379** (F1), and three
independent smaller sweeps agreed [1][2]. The premise that small channels 404 is almost certainly
**our own bug**, not a YouTube property: `@handle` pages contain 17+ decoy `UC…` strings, and one
of our own extractor patterns resolves to a *real but different* channel whose feed returns HTTP
200 and 15 plausible wrong videos [3][4]. The one genuine change in the ecosystem is that
**InnerTube no longer accepts `@handle` as a `browseId`** (HTTP 400 on all 15 client contexts
tested) — but `navigation/resolve_url` replaces it, keyless, with a clean 404 for bogus channels
[5][6]. **Add no dependency**: the only maintained JS option, `youtubei.js`, is 63 MB / 3,537
files for ~30 lines of hand-rolled parsing that reproduced its output exactly [7].

**Confidence:** high on the HTTP behaviour (all measured directly, most corroborated 2+ times);
**medium** on production durability, because every probe ran from a residential IP and our real
deployment is a datacenter IP — the one variable nobody could test [8].

## Why

**1. The feed is alive and is the right primary.** `feeds/videos.xml?channel_id=UC…` served
HTTP 200 with 15 entries for 379/379 real channels; 373 returned exactly 15, 6 returned fewer
(they have fewer public videos), and **none returned more than 15** [1]. The 15-entry cap is
empirically exact but **Google has never documented it** [1]. The only first-party documentation
of the endpoint at all is the Data API v3 push-notifications page, which uses it as the
PubSubHubbub topic URL (footer "Last updated 2026-09-14 UTC") [1][9]. Responses carry
`cache-control: public, max-age=900` and **no ETag / Last-Modified** — conditional requests return
200, never 304, so polling faster than 15 min buys nothing [1][7].

**2. The 404 story is our bug, not YouTube's.** The `@Fireship` page contains 17 distinct
`UC…` strings, including the real id 183 times and several belonging to *other real channels*
[3]. A naive first-match regex lands on "Beyond Fireship", "Veritasium en Français", "The Studio"
[3][4]. Crucially, **our extractor is currently correct** — I replayed `extractChannelId` verbatim
(`externalId` → `browseId` → `channelId`) against 7 handles and it matched `<link rel=canonical>`
7/7 with 7/7 populated feeds [4]. But the third pattern, bare `"channelId"`, resolves to a *real
but wrong* channel whose feed returns **200 with 15 entries** [4]. We are protected only by
pattern ordering. If YouTube ever drops `externalId`/`browseId` — precisely a redesign, the event
that breaks scrapers generally — we silently render another channel's videos. That is worse than
the empty widget we set out to fix.

**3. InnerTube's gate is narrower than reported.** The brief's premise — "WEB now requires a PO
token" — is **not supported**. PO tokens are scoped to *video streaming*, per yt-dlp's own guide
("three cases … GVS, Player, Subs") and enforced only in `_video.py`; `_tab.py`, which does all
channel/playlist listing, contains **zero** `po_token` references [5]. Live: `browse` with a `UC…`
id returns 200 **with no key, no cookie, no token, no client headers** [5][6]. What actually broke
is the *request shape*: `browseId: "@handle"` returns HTTP 400 `INVALID_ARGUMENT` on **all 15
client contexts** tested — WEB, MWEB, ANDROID, ANDROID_VR, IOS, TVHTML5, WEB_REMIX, WEB_KIDS,
WEB_CREATOR, WEB_EMBEDDED_PLAYER, TVHTML5_SIMPLY(+EMBEDDED), MEDIA_CONNECT_FRONTEND,
VISIONOS, ANDROID_TESTSUITE [5][6]. The correct endpoint is
`POST /youtubei/v1/navigation/resolve_url` with `{"url": "…"}`, returning the id at
`response.endpoint.browseEndpoint.browseId` — confirmed independently [5][6]. yt-dlp does exactly
this hop; `youtubei.js` v18.1.0 does **not** and 400s [7].

**4. What is dead.** Piped: **13/15 public instances unreachable**, the official one on HTTP 525,
and Piped-Backend's last commit was 2026-05-29 [10][7]. Invidious: **1 instance** still serves
an API (`invidious.f5.si`) out of 11 listed [10][7]. `feed_id=` returns **HTTP 400 for every id
tried** [10]; Data API v2 is formally retired in Google's terms ("Fully deprecated services …
are no longer supported") [10]. `youtube-dl` is frozen (last release 2024-07-10, 3,625 open
issues) [7]. `ytpl` is archived, `yt-dlp-wrap`'s repo is 404, `@distube/youtubei.js` is removed
from npm, and `youtube.js` never existed [7].

**5. The fragility ceiling is real but bounded.** Counting yt-dlp issues *closed* in a period that
carry both `site-bug` and `site:youtube` labels (query
`repo:yt-dlp/yt-dlp is:issue is:closed label:site-bug label:site:youtube created:<range>`):
**46 in 2024, 103 in 2025, 53 in 2026-01-01..2026-09-27** — roughly 4-9 per month, a sustained tax
rather than a spike [4]. (F6 reported 76/196/117 for what it described as the same query; those
figures are **not reproducible** under any query form I tried, so the numbers above are my own.
The conclusion is unaffected; the magnitude is about half what F6 claimed.) That is an **upper
bound** — yt-dlp parses formats, signatures and player responses, far harder than reading an Atom
feed. Glance, our own reference implementation, has had issue #910 open since 2025-12-21 with
recurrences through 2026-09-11 (verified today: `state: open`, created `2025-12-21T05:56:13Z`,
updated `2026-09-11T23:27:43Z`, 12 comments), its maintainer writing "we're at the mercy of the
RSS feed and its (as of the last few months) lack of stability" [11]. The community converges on
*degrade, don't break* [11].

## What would change this

A datacenter-IP result. Every probe here ran from a residential connection; FreeTube received a
403 + "your computer or network may be sending automated queries" from a **residential, non-VPN**
user in December 2025 [11], so residential success does not prove datacenter success. yt-dlp's
guide warns that missing tokens can get "your account or IP address being blocked" [5]. **Re-run
the two proven calls — one feed fetch and one `resolve_url` — from the actual deployment host
before trusting any of this in production.** That single test is worth more than every other
recommendation here.

## Considered and rejected

- **`youtubei.js` (the only maintained JS option).** Rejected on weight: 15.08 MB unpacked, 63 MB
  / 3,537 files on disk, dragging in `meriyah` (a full ES2020 parser) and `@bufbuild/protobuf`
  [7]. F5 wrote a **30-line zero-dependency recursive walk** over the same response and got
  **28 ids in identical order** to the library, on Bun [7]. It also **removed** `getFeed()` in
  v18, so it cannot even replace our RSS path [7]. It has **no Bun in CI** [7].
- **`fast-xml-parser` / `rss-parser`.** We already parse this feed. `rss-parser` has had no
  release since 2023-04-11 while adding `xml2js` + `entities` [7]. 90M weekly downloads makes
  `fast-xml-parser` a high-value CVE target for a fixed, small Atom shape [7].
- **`youtube-dl-exec` / yt-dlp.** Maintained (v3.1.15, 2026-09-05) but it is a process wrapper
  around a `yt-dlp` binary needing Python 3.11+ and a **non-Bun** JS runtime — Bun is explicitly
  deprecated as a yt-dlp runtime [7]. It adds a subprocess per dashboard refresh.
- **Piped / Invidious public instances.** Not uptime that kills them — **silent emptiness**. F4
  found four distinct 200-with-empty-body responses today that are indistinguishable from success
  by status code or `/healthcheck` [10]. Depending on a volunteer's instance would reintroduce
  exactly the defect we are fixing.
- **`UU`/`UULF` as a second feed URL.** Alive and served — 200/15 on 7/7 of F5's own channel set
  in my run, and 7/7 in F4's [4][10] — but they are **byte-equivalent to `channel_id=`**, so they
  fail together and buy nothing [10]. (F5 reported `UULF` 404 7/7; that measurement is **rejected** —
  see Conflicts.)

## Findings

### Recommended chain (research only — no code changed)

1. **Resolve `@handle` → UC id** via `POST /youtubei/v1/navigation/resolve_url`, keeping the
   channel-page scrape as fallback. Cross-check any scraped candidate against
   `<link rel="canonical">` / `og:url` and **reject on mismatch** [3][4][5].
2. **Fetch `feeds/videos.xml?channel_id=UC…`**. Assert on **item count**, never on HTTP status
   alone [10].
3. **If the handle cannot be resolved, do not feed the handle into `channel_id=`.** Today we do
   (`videos.ts:223-231` sets `id = ch`, producing `?channel_id=%40Fireship`, a *guaranteed* 404)
   [4]. That 404 is manufactured by us and misattributed to YouTube.
4. **Fall back to InnerTube `browse` with `browseId=UC…` + videos-tab `params`**, or
   `browseId=VL<playlistId>` for playlists — both 200 keyless [5][7].
5. **Keep the `ytInitialData` /videos scrape last.** It is a moving target right now: yt-dlp PR
   #17703 "[ie/youtube] Fix initial data extraction" was approved 2026-09-19 and was **still
   unmerged** on 2026-09-27 [11].

### Failing loudly (the design constraint)

| observed | meaning | required behaviour |
|---|---|---|
| feed 404 | id is wrong or absent — **ambiguous**, no distinguishing header [1] | StatusDot on that source; never an empty widget |
| feed 200, 0 entries | channel genuinely has no public videos [1] | not an error; show "no videos", not a failure dot |
| `resolve_url` 404 | clean `{"error":{"message":"Requested entity was not found."}}` [5][6] | **the only unambiguous "bad config" signal we have** |
| `resolve_url` 200, no `browseId` | unresolved — assert, do not default [5] | failure dot |
| 200 with 0 items from a fallback | parse broke | failure dot, never `[]` |

Two states we currently cannot distinguish: **terminated channel** vs **channel with no public
videos** [1][11]. Both need resolving before "loud" can mean "accurate".

### Playlists

`playlist_id=PL…` works — 200 with entries on 29/29 of one channel's playlists [7]. But the feed
is a **positional window of the first 15 slots in playlist order, not the 15 most recent** — proven
three independent ways, including a 28-item playlist where the feed matched the first 15 exactly
[7]. For an owner-ordered oldest-first playlist ("all episodes", curricula) the feed returns the
**oldest** videos and looks permanently stale: a widget built on it is *wrong*, not merely
incomplete [7]. One playlist returned 14 not 15 — a dropped item whose cause is unverified [7].
`playlist_id` is **undocumented** by Google (unlike `channel_id`) and so carries no contract [7].
Use `VL<id>` InnerTube when a full listing is needed [5][7].


### Subscriptions

No unauthenticated merged subscription feed exists. `feed_id=` is dead (400) [10]; Invidious
`/api/v1/feed/subscriptions` returns **200 with a 0-byte body** [10]; rss-bridge's
`YoutubeBridge.php` has no subscription context [10]. The only supported route is OAuth
`subscriptions.list?mine=true`, which returns channelIds — a fan-out, not a feed, and needs an
account [10]. **`UU` is not a subscriptions feed.** Out of scope for us.

### Dependency verdict

**Add nothing.** Our own XML helper covers the feed; `resolve_url` and `browse` are one `fetch`
each; a 30-line recursive walk over the InnerTube JSON matched the library exactly [7].

## Open questions

1. **Datacenter-IP behaviour — the blocking unknown.** Untestable from here [5][7][8].
2. **Feed behaviour for a terminated channel**: 404, or 200-with-0-entries? Unverified [1][11].
3. **The intermittent 404/500 bursts** (Google AI forum 2025-12-27 → 2026-05-02; Miniflux #4261;
   Newsboat #3269) have **no documented mechanism** and did not reproduce under 80 rapid requests
   [1]. Users correlate them with ~12h client uptime, not request volume [1]. Genuinely unverified.
4. **In-progress premieres** in the feed: unverified; completed streams do appear [1].
5. **PubSubHubbub delivery**: the hub accepts channel *and* playlist subscriptions (HTTP 202), but
   **zero successful deliveries were observed** [7]. A 202 is not proof of delivery.

## Sources

Accessed 2026-09-27 unless noted. [primary] = first-party/own measurement · [secondary] = forum
or blog, used only where no primary exists.

1. [primary] F1 findings — 379-channel sweep, malformed-id matrix, UA comparison, 80-request burst, header capture. `findings/F1.md`; also https://developers.google.com/youtube/v3/guides/push_notifications · https://github.com/miniflux/v2/issues/4261 · https://github.com/newsboat/newsboat/issues/3269 · https://discuss.ai.google.dev/t/youtube-rss-feed-endpoint-returns-404-errors/113379
2. [primary] F0 orchestrator HTTP probe — endpoint liveness, `feeds.youtube.com` dead, InnerTube 15-context matrix. `findings/F0-primary-http-evidence.md`
3. [primary] F1 §C3 decoy-UC measurement (17 distinct ids in @Fireship HTML; 3/3 naive-regex misses) · F5 §A0 independent reproduction
4. [primary] F0 §C5b–C5g — verbatim replay of `extractChannelId` vs canonical, 7/7 correct; `channelId`-pattern landmine; 404-manufacturing defect; UULF conflict resolution. `findings/F0-primary-http-evidence.md`
5. [primary] F3 — 110 live InnerTube probes, 3 repos cloned at pinned commits (`YouTube.js` @ `bad89d2` 2026-09-24, `yt-dlp` @ `c7fb478` 2026-09-16, `NewPipeExtractor` @ `4818304` 2026-09-21); https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide · https://github.com/LuanRT/YouTube.js/blob/main/src/utils/Constants.ts · https://github.com/TeamNewPipe/NewPipeExtractor
6. [primary] F0 §C6 — independent `resolve_url` confirmation, 6/6 including bogus-handle 404
7. [primary] F5 — npm registry `time` fields + downloads API, 29-playlist sweep, 30-line zero-dep walk · F2 — 38 sources incl. PyPI/GitHub release feeds · F0 §C7. `findings/F5.md`, `findings/F2.md`
8. [primary, negative] F3 G1, F5 Gaps, F6 Gaps — datacenter-IP behaviour untested, stated by all three workers
9. [primary] https://developers.google.com/youtube/v3/guides/push_notifications (footer "Last updated 2026-09-14 UTC")
10. [primary] F4 — https://api.invidious.io/instances.json (11 instances, 1 with `api:true`) · https://raw.githubusercontent.com/TeamPiped/documentation/main/content/docs/public-instances/index.md (15 instances) · https://github.com/RSS-Bridge/rss-bridge/blob/master/bridges/YoutubeBridge.php · https://developers.google.com/youtube/terms/subject-api-services
11. [primary] F6 — https://github.com/glanceapp/glance/issues/910 (open 2025-12-21 → 2026-09-11; state independently re-verified by me) · https://github.com/yt-dlp/yt-dlp/pull/17703 · https://github.com/DialmasterOrg/Youtarr/issues/621. *F6's yt-dlp issue counts were not reproducible and are superseded by [4].*
