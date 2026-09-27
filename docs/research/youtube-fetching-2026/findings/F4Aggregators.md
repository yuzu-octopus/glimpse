# Angle: Aggregator/bridge services (Piped, Invidious) + merged-subscription feeds

All counts below are what I actually fetched on **2026-09-27** from this host (datacenter IP, no
Google account, no cookies, plain `Mozilla/5.0` UA). Commands were `curl` unless noted.

## Claims

### Piped & Invidious project liveness

- **iv-org/invidious is ALIVE.** Last commit on `master` `2026-09-16T03:28:31Z`; latest release
  `v2.20260804.1` published `2026-08-05 01:03:59 UTC` (prior: `v2.20260804.0` 2026-08-04,
  `v2.20260723.0` 2026-07-23, `v2.20260626.0` 2026-06-27, `v2.20260207.0` 2026-02-07).
  — `https://github.com/iv-org/invidious/commits/master.atom`,
  `https://github.com/iv-org/invidious/releases` — fetched 2026-09-27 — **primary**
- **TeamPiped/Piped-Frontend is ALIVE** (last commit `2026-09-11T02:50:48Z`); **Piped-Backend is
  STALE** (last commit `2026-05-29`, i.e. 4 months cold). Commit titles on 2026-05-29 include
  "Add an alternative way for updating feeds for closed off instances (#889)".
  — `https://github.com/TeamPiped/Piped-Frontend/commits/master.atom`,
  `https://github.com/TeamPiped/Piped-Backend/commits/master` — fetched 2026-09-27 — **primary**
- **TeamNewPipe/NewPipeExtractor is ALIVE** (last commit `2026-09-21`). It is Piped's extraction
  engine — Piped's README states it "Uses NewPipeExtractor to extract information", not a bespoke
  InnerTube client. — `https://github.com/TeamPiped/Piped`,
  `https://github.com/TeamNewPipe/NewPipeExtractor/commits/dev.atom` — fetched 2026-09-27 — **primary**
- **rss-bridge is ALIVE but self-host-only** (last commit `2026-08-28T16:45:52Z`). Its YouTube
  bridge source declares `const DESCRIPTION = 'Returns the 10 newest videos by username/channel/playlist
  or search'` — **no merged-subscription support**, and no public instance exists.
  — `https://raw.githubusercontent.com/RSS-Bridge/rss-bridge/master/bridges/YoutubeBridge.php`,
  `https://github.com/RSS-Bridge/rss-bridge/commits/master.atom` — fetched 2026-09-27 — **primary**

### InnerTube client status (the PO-token question)

- **The ANDROID and IOS InnerTube clients are dead and were deleted upstream.** NewPipeExtractor PR
  #1529 *"Remove broken clients, update clients constants and fix some tests"* (opened
  `2026-08-06`, closed `2026-08-13`), author AudricV, states verbatim:
  > "This pull requests removes ANDROID and IOS clients, as using them requires **poTokens nobody can
  > generate**. The WEB_EMBEDDED client one … has been completely removed too as it wasn't used for
  > a long time."
  It also deleted `YoutubeStreamExtractor.forceFetchIosClient`, `YoutubeParsingHelper.getAndroidUserAgent`,
  `getIosUserAgent`, `isAndroid…`.
  — `https://github.com/TeamNewPipe/NewPipeExtractor/pull/1529` — fetched 2026-09-27 — **primary**
- **Only 4 client families remain in NewPipeExtractor.** I read the entire `ClientsConstants.java`
  (1839 bytes): the file now contains *only* `WEB` (`2.20260805.01.00`), `WEB_REMIX`
  (`1.20260804.16.00`, client id 67), `WEB_MUSIC_ANALYTICS` (id 31), `VISIONOS` (id 101). No
  `ANDROID*` or `IOS*` constant survives.
  — `https://raw.githubusercontent.com/TeamNewPipe/NewPipeExtractor/dev/extractor/src/main/java/org/schabi/newpipe/extractor/services/youtube/ClientsConstants.java`
  — fetched 2026-09-27 — **primary**
- **Invidious still keeps 15 hardcoded clients, but no PO-token machinery.**
  `src/invidious/yt_backend/youtube_api.cr` `HARDCODED_CLIENTS` defines 15 `ClientType` entries
  (`Web, WebEmbeddedPlayer, WebMobile, WebScreenEmbed, WebCreator, Android, AndroidEmbeddedPlayer,
  AndroidScreenEmbed, AndroidTestSuite, IOS, IOSEmbedded, IOSMusic, TvHtml5, TvHtml5ScreenEmbed,
  TvSimply`); the default is `ClientType::Web` at version `2.20260722.01.00`. Grepping that file
  for `poToken|attestation|botguard|BotGuard` returns **0 matches**.
  — `https://raw.githubusercontent.com/iv-org/invidious/master/src/invidious/yt_backend/youtube_api.cr`
  — fetched 2026-09-27 — **primary**
- **The WEB client is confirmed working on the wire today, unauthenticated.** Decoding the
  `nextpage.body` blob that `pipedapi.ducks.party` returned from `/channel/UCsBjURrPoezykLs9EqgamOA`
  shows a plain InnerTube `browse` request with
  `clientName:"WEB", clientVersion:"2.20260925.01.00", platform:"DESKTOP", gl:"GB"`,
  `"cookies":null` and **no `serviceIntegrityDimensions` / PO-token field** — and it returned 30
  real videos. This is direct evidence that PO-tokens gate *streaming*, not *channel listing*.
  — fetched 2026-09-27 — **primary** (see Conflicts #4 and the Piped section for the full context)
- **Implication [inference, marked]:** because only the WEB client survives, the InnerTube path is
  *WEB-scraping-shaped*, not the datacenter-cheap ANDROID-client path that NewPipe/Piped used
  pre-2024. That raises the bot-detection exposure of any datacenter-IP scraper relative to
  2023–24. I did not measure a block rate, so I am not claiming a number.

### Invidious public instances — actual counts

Source: `https://api.invidious.io/instances.json?sort_by=type,users` (fetched 2026-09-27 08:36–08:40Z,
instance monitor data stamped `2026-09-27T08:36Z`–`08:40Z`).

- **Total instances listed: 11.** Breakdown: **7 HTTPS**, 2 I2P, 2 Tor/onion.
- **Only 4 of 7 HTTPS instances had `monitor.last_status == 200`.**
- **Only 1 of 7 advertises `api: true` → `invidious.f5.si`.** `cors: true` likewise only on f5.si.
- `yt.chocolatemoo53.com`: `stats: null`, `last_status: null`,
  `error: "Connection timeout (10 seconds)"`.
- `inv-ygg.nadeko.net`, `inv.nadeko.ygg`: `monitor: null` (Yggdrasil, unmonitored).
- — **primary** (the instances API is Invidious's own canonical registry)

**The `api: true` flag is load-bearing — I verified it, do not assume otherwise:**

- `invidious.f5.si/api/v1/channels/UCsBjURrPoezykLs9EqgamOA` → `200`, 50 369 B, real data.
- `inv.nadeko.net/api/v1/channels/UCsBjURrPoezykLs9EqgamOA` → **`403`** (instance has `api: false`).
- `inv.nadeko.net/api/stats/version` → **`502`**.
- So the effective count of *usable* Invidious API endpoints on the whole public fleet today is **1**.

**Invidious API surface actually observed on `invidious.f5.si`:**

| endpoint | status | body |
|---|---|---|
| `/api/v1/channels/UCsBjURrPoezykLs9EqgamOA` | 200 | 50 369 B, real channel |
| `/api/v1/channels/UCsBjURrPoezykLs9EqgamOA/videos` | 200 | 96 003 B |
| `/api/v1/playlists/PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb` | 200 | 24 695 B |
| `/api/v1/feeds/trending` | **200** | **0 bytes** |
| `/api/v1/feed/subscriptions` | **200** | **0 bytes** |
| `/api/v1/subscriptions` | **200** | **0 bytes** |
| `/api/v1/auth/feeds` | 403 | `{"error":"Request must be authenticated"}` |
| `/api/v1/search?q=x` | 200 | — |
| `/api/v1/stats` | 200 | — |

### Invidious: two silent-empty traps (directly relevant to "fail loudly")

- **`/api/v1/channels/:id` returns `videos: []` and `title: null` on a healthy instance.** I parsed
  the Fireship response: `author = "Fireship"`, `authorId = "UCsBjURrPoezykLs9EqgamOA"`,
  `subCount = 4280000`, and 30 items under **`latestVideos`** (e.g. "Meta is pivoting again… |
  1 day ago | c1rPlzxSZ8E"). `videos` is present but an empty list, `title` is `None`.
  Any client reading `videos[]` or `title` gets an empty widget from an HTTP **200**.
  — fetched 2026-09-27 — **primary** (observed response)
- **`/api/v1/feeds/trending` returns HTTP 200 with a 0-byte body.** Verified twice.
- Invidious's monitored instance is fronted by **Cloudflare** (`server: cloudflare`,
  `cf-ray: a4193fb79a0a40fe-SIN`, `cf-cache-status: DYNAMIC`) — so instance-level rate limiting
  and bot rules are Cloudflare's, and instance-level 200-with-empty-body behaviour is behind them.
  — `curl -D-` on `invidious.f5.si` — **primary**

### Piped public instances — actual counts

Canonical list = Piped's own docs repo (linked from the Piped README):
`https://github.com/TeamPiped/documentation/blob/main/content/docs/public-instances/index.md`
(raw fetched 2026-09-27). **15 instances listed.** Probed `GET {api}/trending` on each:

| instance | result |
|---|---|
| pipedapi.kavin.rocks (Official) | **525** |
| pipedapi.leptons.xyz | **502** |
| pipedapi.nosebs.ru | 000 (conn fail) |
| pipedapi-libre.kavin.rocks | 000 (20 s timeout) |
| piped-api.privacy.com.de | 000 (conn fail) |
| pipedapi.adminforge.de | 301 → `adminforge.de` (a Forgejo host, **not** a Piped API) → 404 |
| api.piped.yt | 000 (conn fail) |
| pipedapi.drgns.space | 000 (conn fail) |
| pipedapi.owo.si | 000 (conn fail) |
| pipedapi.ducks.party | **400 `{"error":"region is a required parameter"}` → ALIVE** |
| piped-api.codespace.cz | 000 |
| pipedapi.reallyaweso.me | **502** |
| api.piped.private.coffee | **400 `{"error":"region is a required parameter"}` → ALIVE** |
| pipedapi.darkness.services | 000 (conn fail) |
| pipedapi.orangenet.cc | 000 (conn fail) |

- **2 of 15 respond at all; 13 of 15 are dead.** The official instance is down with **HTTP 525**
  (Cloudflare SSL handshake failed). Both "live" ones require a **new mandatory `region` query
  parameter** (it is documented on `/trending` in `swagger.yaml`, but undocumented on the other
  endpoints and unannounced anywhere I found). `/healthcheck` returns 200 on both.
- **CORRECTION (see Conflicts #4): the channel endpoints work — I had used the wrong paths.**
  Piped's OpenAPI spec (`https://raw.githubusercontent.com/TeamPiped/OpenAPI/main/swagger.yaml`,
  28 621 B, `main`, fetched 2026-09-27) declares the paths
  `/trending`, `/streams/{videoId}`, **`/channel/{channelId}`**, **`/c/{name}`**,
  `/user/{username}`, `/nextpage/channel/{channelId}`, `/comments/{videoId}`,
  `/nextpage/comments/{videoId}`, `/search`, `/nextpage/search`, `/feed/unauthenticated`.
  It documents `region` as a parameter of `/trending` (`name: region`,
  `description: The Region to get trending videos from.`) and defines a `Regions` schema at
  line 406. **Note it declares neither `/playlists/…` nor `/channels/…`.**
- **Measured API surface on the 2 live instances (paths per the spec):**

| endpoint | pipedapi.ducks.party | api.piped.private.coffee |
|---|---|---|
| `/trending` | 400 `region is a required parameter` | 400 same |
| `/trending?region=US` | **200** 13 374 B | **200** 13 366 B |
| `/search?q=test&filter=videos&region=US` | **200** | — |
| **`/channel/UCsBjURrPoezykLs9EqgamOA`** | **200** 20 952 B, **30** `relatedStreams` | **200** 4 682 B, **`relatedStreams: 0`** |
| **`/c/Fireship`** (by handle) | **200** 21 141 B, 30 `relatedStreams` | **200** 4 682 B, 0 |
| `/user/GoogleDevelopers` | **200** 20 925 B | **200** 4 500 B |
| `/playlists/PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb` | **200** 660 B — see below | **200** 666 B |
| `/feed/channel/UCsBjURrPoezykLs9EqgamOA` | 404 — *not a Piped path* | 404 |
| `/channels/UCsBjURrPoezykLs9EqgamOA` | 404 — *not a Piped path* | 404 |
| `/feed/unauthenticated` | 400 (33 B) | 400 |
| `/nextpage/channel/UCsBjURrPoezykLs9EqgamOA` | 400 (44 B) | 400 |
| `/streams/UCsBjURrPoezykLs9EqgamOA` | 500 | — |

  So `/channel/{id}` **and the handle form `/c/{name}`** both work unauthenticated and return
  real video lists. `name`, `subscriberCount` (4 280 000 for Fireship) and a populated `nextpage`
  are all correct in both instances' responses. This is the one aggregator route that actually
  delivered channel videos in this test.
- **Piped's InnerTube call is WEB-client, cookie-free, PO-token-free — confirmed from the wire.**
  The `nextpage` object in `pipedapi.ducks.party`'s `/channel/…` response embeds a base64 `body`
  whose decoded context is `{"context":{"client":{"hl":"en-GB","gl":"GB","clientName":"WEB",
  "clientVersion":"2.20260925.01.00","originalUrl":"https://www.youtube.com","platform":"DESKTOP",
  "utcOffsetMinutes":0,"user":{"lockedSafetyMode":false},"request":{"useSsl":true,"userAgent":
  "DESKTOP"}}}`. Note `"cookies":null` and **no `serviceIntegrityDimensions` / PO-token field**.
  This is direct primary evidence that the WEB InnerTube client still serves channel listings
  unauthenticated from a datacenter IP today. — fetched 2026-09-27 — **primary**
- **Piped's playlist endpoint is a silent-empty.** The `200` response body is:
  `{"name":"Top Trending Videos of the Week", … ,"videos":19, "relatedStreams":[],"nextpage":null}`
  — it reports a video *count* of 19 while returning an **empty `relatedStreams` array**. A
  dashboard reading `relatedStreams` renders an empty widget on an HTTP 200.
  — fetched 2026-09-27 — **primary** (observed response)
- **A live Piped instance can be half-broken and still return 200 — the worst failure mode found.**
  Same request, same moment, both HTTP 200: `pipedapi.ducks.party` returned 30 `relatedStreams`
  with `duration 341` on the first item; `api.piped.private.coffee` returned
  `name: "Fireship"`, `subscriberCount: 4280000`, `nextpage` present — and
  **`relatedStreams: 0`**. Correct metadata, empty video list, HTTP 200. A status-code-only health
  check cannot detect this. — fetched 2026-09-27 — **primary** (observed response)
- `https://piped.video/api/v1/instances` is **not** an instance registry — it returns the
  frontend's HTML `404 Page not found`. `https://piped-instances.kavin.rocks/` **timed out**
  (the historically canonical list, dead). The docs repo is the only list still serving.

### Part B — merged subscription feeds

- **`feed_id=` is DEAD unauthenticated: it returns HTTP 400 for *every* id I tried**, including
  real channel ids. Tested 5 ids (`UCBvEwowg1s4K0zL7SgEztw`, `UC_x5XG1OV2P6uZZ5FSM9Ttw`,
  `sBjURrPoezykLs9EqgamOA`, `1VwK0Xu2b4LK7h1L0zTAUw`, `4pU9LgTcg5b1HnpDLZAbXA`) → all
  `http=400, entries=0`, body `<title>Error 400 (Bad Request)!!1</title>`. No id produced a 200.
  — `https://www.youtube.com/feeds/videos.xml?feed_id=<id>` — fetched 2026-09-27 — **primary**
- **YouTube itself no longer exposes legacy user ids.** Fetching `youtube.com/@YouTube/about` and
  `youtube.com/user/GoogleDevelopers` (1.6–1.9 MB of `ytInitialData`), every discoverable id is a
  `UC…` channel id; `externalId` is `"UC_x5XG1OV2P6uZZ5FSM9Ttw"`. There is no separate user-id
  namespace left in the payload to feed into `feed_id=`. — fetched 2026-09-27 — **primary**
- **Google's only documented feed form is `channel_id`.** The official PubSubHubbub page says: set
  the topic URL to `https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID`. Neither
  `playlist_id` nor `feed_id` appears anywhere in the doc. Page footer: **"Last updated 2026-09-14
  UTC"** — live and current. — `https://developers.google.com/youtube/v3/guides/push_notifications`
  — **primary**
- **Data API v2 (the origin of `feed_id`/GData feeds) is formally dead.** Google's own terms page
  states verbatim: *"Fully deprecated services, such as Data API v2, Flash, and JavaScript Player
  APIs, are no longer supported."* — `https://developers.google.com/youtube/terms/subject-api-services`
  — fetched 2026-09-27 — **primary**. (The `/youtube/2.0/` and `/youtube/2.0/deprecation_faq` URLs
  are now 404 — I verified; do not cite them.)
- **No Invidious route to subscriptions without auth.** `/api/v1/auth/feeds` → 403
  `{"error":"Request must be authenticated"}`. The two unauth lookalikes `/api/v1/feed/subscriptions`
  and `/api/v1/subscriptions` return **200 with a 0-byte body** — indistinguishable from success by
  status code. — fetched 2026-09-27 — **primary**
- **No rss-bridge route either.** `YoutubeBridge.php` supports username / channel / playlist /
  search, 10 newest each, `CACHE_TIMEOUT = 3 hours`. No subscription context; self-host only.
  — `https://raw.githubusercontent.com/RSS-Bridge/rss-bridge/master/bridges/YoutubeBridge.php`
  — fetched 2026-09-27 — **primary**
- **The only supported merged-subscription mechanism is OAuth + `subscriptions.list?mine=true`,
  which returns channelIds you then feed per-channel** — i.e. it is not a merged feed, it is a
  fan-out. Out of scope for us (no Google account).

### `UU` / `UULF` / `PL` playlist-id variants — controlled test

`https://www.youtube.com/feeds/videos.xml?playlist_id=<X>`, 2026-09-27:

| channel | `channel_id=` | `playlist_id=UU<stripped>` | `playlist_id=UULF<stripped>` |
|---|---|---|---|
| UCsBjURrPoezykLs9EqgamOA (Fireship) | 15 | 15 | 15 |
| UC8butISFwT-Wl7EV0hUK0BQ | 15 | 15 | 15 |
| UCBVFUW4ZVB132LemI1M8xI | 0 | 0 | 0 |
| UCXuqSBlQ1sauaU2e6RnbUtGg | 0 | 0 | 0 |
| UCVb5HqWHlE5eWZjZYjnpIzg | 0 | 0 | 0 |
| UCrfv5Jo4MwW7qIpNrwJgKVA | 0 | 0 | 0 |
| UCjXfkj5iapK5rhYwvYuoRpcQ | 0 | 0 | 0 |

- **`UU…` and `UULF…` are ALIVE and served** (HTTP 200, 15 entries) — but they are **not distinct
  feeds**. Across all 7 channels the three methods agreed **exactly** (15/15/15 and 0/0/0 in every
  row). `UULF` returned no entry that `channel_id` did not already return. The rows that return 0
  are ids that do not resolve to a real channel at all (`channel_id` control also returns 0), not
  an uploads-playlist-specific failure.
- **I therefore found no evidence that `UULF` is a distinct "uploads-from-latest" feed or a
  fallback for a `channel_id` failure.** I could not find any first-party Google documentation of
  `UU`/`UULF` ids — they are not in the push-notifications doc, and
  `support.google.com` only documents `channel_id`. Their existence is an **observed server
  behaviour, not a documented contract** (tag: `unverified` as to permanence).
- **The feed is hard-capped at 15 entries.** `channel_id`, `UU`, `UULF`, `?user=` and a real
  `playlist_id=PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb` (33 926 B) all returned **exactly 15** entries.
- **`?user=<legacy username>` still works** as a legacy alias: `?user=GoogleDevelopers` → 200,
  25 166 B, 15 entries, self-link `...videos.xml?user=GoogleDevelopers`, `<id>yt:channel:_x5XG1OV2P6uZZ5FSM9Ttw</id>`,
  `<title>Google for Developers</title>`, `<yt:channelId>_x5XG1OV2P6uZZ5FSM9Ttw</yt:channelId>`.
  A bogus username → **404**. Useful if configs still hold old usernames; not a subscriptions feed.
  — all fetched 2026-09-27 — **primary**

### Fragility verdict for depending on a random public instance

- **Observed, not inferred:** 13/15 Piped instances unreachable, the official one on 525. 6/7
  Invidious HTTPS instances do not serve the API (403) or are unmonitored. So the entire public
  fleet reduces to **1 working Invidious API host** (`invidious.f5.si`) and **2 working Piped API
  hosts** (`pipedapi.ducks.party`, `api.piped.private.coffee`) — and one of those two is
  half-broken (silent-empty channel lists). Piped additionally changed its API surface
  (mandatory `region`) with no changelog, and ships no `/playlists/…` in its spec despite serving
  one. **A dashboard must not treat any public instance as a dependency.**
- **The decisive argument against depending on them is not uptime, it is silent-emptiness.** I found
  four distinct 200-with-empty-body cases today: Invidious `/api/v1/channels/:id` (`videos:[]`,
  `title:null`), Invidious `/api/v1/feeds/trending` (0 bytes), Invidious
  `/api/v1/feed/subscriptions` + `/api/v1/subscriptions` (0 bytes), Piped
  `/playlists/:id` (`videos:19, relatedStreams:[]`), and Piped `private.coffee` `/channel/:id`
  (`relatedStreams:0`). None are distinguishable from success by status code or by `/healthcheck`.
  Any widget fed by these must assert on **item count**, never on HTTP status.
- Rate limits: I fired **12 rapid sequential requests** at `invidious.f5.si/api/v1/channels/…` —
  **12/12 returned 200** (1.3–2.2 s each), no 429, no `Retry-After`. So no rate limit was
  observable at 12 req/s-of-one from a single IP over ~20 s. This does **not** establish a rate
  limit; it establishes only that a short burst was not blocked. Unverified beyond that.
- Self-host cost: not measured (out of angle).

## Searches

- `web_search`: "YouTube help \"RSS\" channel feed \"feeds/videos.xml\" support.google.com"
- `web_search`: "YouTube \"feeds/videos.xml\" \"feed_id\" deprecated removed subscriptions feed"
- `web_search`: "rss-bridge YouTube bridge 2026 self-host"
- `read`/`curl`: `https://api.invidious.io/instances.json?sort_by=type,users`
- `read`/`curl`: `https://raw.githubusercontent.com/TeamPiped/documentation/main/content/docs/public-instances/index.md`
- `read`: `https://github.com/TeamPiped/Piped` (README — canonical list pointer, NewPipeExtractor claim)
- `read`: `https://developers.google.com/youtube/v3/guides/push_notifications`
- `read`/curl: `https://developers.google.com/youtube/2.0/` (404), `/youtube/2.0/deprecation_faq` (404), `/youtube/terms/subject-api-services` (200)
- `read`/curl: `https://raw.githubusercontent.com/TeamPiped/OpenAPI/main/swagger.yaml` — Piped path
  and parameter inventory; the correction in Conflicts #4 came from this file
- `curl` probes: `/channel/{id}`, `/c/{name}`, `/user/{name}`, `/feed/unauthenticated`,
  `/nextpage/channel/{id}` on both live Piped instances; `/api/v1/{channels,playlists,feeds,
  feed/subscriptions,subscriptions,auth/feeds,search,stats}` on `invidious.f5.si`
- GitHub atom feeds: `iv-org/invidious` (master + releases), `TeamPiped/Piped-Frontend`,
  `TeamPiped/Piped-Backend`, `TeamNewPipe/NewPipeExtractor`, `RSS-Bridge/rss-bridge`
- GitHub REST `api.github.com/repos/*` — **rate-limited from this IP** ("API rate limit exceeded
  for 101.127.22.144"); switched to atom feeds + HTML. Noted for the audit trail.

## Conflicting evidence

1. **Piped "is dead" vs "is alive".** Backend stale since 2026-05-29 and 13/15 instances down
   suggests abandonment; but frontend committed 2026-09-11, both live instances serve fresh
   trending **and** fresh channel data, and the WEB InnerTube client underneath them works
   (see below). **Resolution:** the *project* and the *engine* are alive; the *public fleet* is
   near-dead (2 of 15, one of those half-broken). The surviving backends must be running code
   newer than the last backend commit I can see, since they demand a `region` param that
   `master` does not apply outside `/trending`. Carry forward: **Piped's channel route works and
   is a legitimate fallback; Piped's public instance fleet is not a dependency.**
2. **NewPipeExtractor "removed ANDROID" vs Invidious "still has 15 clients".** Both are true and
   measure different things. **Resolution:** they diverge. Invidious *keeps* dead client constants
   but defaults to `WEB` and has no PO-token code; NPE *deleted* the same constants outright and
   now ships 4 families. Since Invidious actually works on channel/playlist/video endpoints today
   (I verified 200s), the constants being present is not evidence those clients work. Carry
   forward: **WEB client is the only verified-working InnerTube path**; treat all others as dead.
3. **`UULF` "fixes empty channels" (the Glance comment) vs my measurement.** Glance's premise is
   that `UULF` returns entries where `channel_id` does not. **Resolution: my controlled test
   contradicts it** — the two agreed on all 7 channels. The premise is probably a stale comment
   from a transient 2020-era failure, or it was observed for *invalid/renamed* channel ids where
   a cached mapping mattered. I could not reproduce any case where `UULF` beat `channel_id`.
4. **Self-correction: I first reported Piped's channel endpoints as "GONE" (404). That was wrong.**
   I had probed `/channels/:id` and `/feed/channel/:id`, which are **not Piped paths**. Reading
   `TeamPiped/OpenAPI/swagger.yaml` showed the real paths are `/channel/{channelId}` (singular) and
   `/c/{name}`, and those return **200 with 30 real videos**. **Resolution: the spec is
   authoritative over my path guess; Piped's channel endpoint works.** This is a methodological
   note worth carrying into the report: an aggregator 404 is far more often a wrong path than a
   dead feature, so the spec must be read before declaring an endpoint removed. The earlier
   "Piped = unusable" framing is **withdrawn** — Piped's channel route works, its *fleet* is the
   problem.

## Gaps

- **No first-party Google documentation exists for `UU`/`UULF`** playlist-id construction. I
  searched the push-notifications doc and the YouTube Help centre; neither mentions them. Their
  persistence is observed behaviour only and could vanish without notice. Anything relying on them
  is `[unverified]`.
- **`feed_id` with an auth cookie is untested** — we have no Google account and no cookies by
  constraint, so I cannot rule out that it works for a logged-in session. Irrelevant to us, but I
  will not claim it is 400 *for authenticated users*; only that it is 400 unauthenticated.
- **No true legacy YouTube *user* id** could be obtained (YouTube no longer emits one), so my
  `feed_id` sweep used channel-shaped ids plus arbitrary 24-char ids. The uniform 400 across all
  of them is strong but not exhaustive.
- **Invidious instance uptime percentages** are from uptime-monitor's own data inside
  `instances.json` (e.g. 99.788, 90.676, 81.447, 97.812); these are third-party monitor figures
  republished in the registry, not Invidious-project measurements.
- **Self-host cost / bandwidth** for Invidious or Piped was not measured — out of this angle.
- ~~Piped's `region` param is not in any spec I could locate.~~ **Resolved:** `swagger.yaml`
  documents `region` on `/trending` (line 40) with a `Regions` schema (line 406). Still unknown
  whether the other endpoints require it too — they returned 200 without it.
- **Piped's `/playlists/{id}` endpoint is not in `swagger.yaml`** yet works on both live
  instances. Spec/behaviour drift inside the same project.
- **I did not test Piped's `/feed/unauthenticated` semantics** (it returned 400 on both live
  instances; body not inspected). Its name suggests a public "trending"-style feed, not
  subscriptions, but I did not confirm — do not cite it as a subscriptions route.
