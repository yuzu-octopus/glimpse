# Angle: Direct HTTP probing of YouTube endpoints (orchestrator-run, primary source)

All probes run from one host (macOS, residential/consumer network, no cookies, no Google
account, no proxy). No API key used for the RSS feeds. Date: **2026-09-27**.

## Claims

### C1 — `feeds/videos.xml?channel_id=UC...` endpoint is ALIVE. 404s are bad IDs, not endpoint death.
- `UCXuqSBlHAE6Xw-yeJA0Tunw` (YouTube's own channel) -> **HTTP 200, 34,919 bytes** of Atom XML with entries.
- `feeds.youtube.com` (legacy host) -> **does not resolve** (`curl` code 000, DNS/connection failure). Dead host. Do not use.
- Three IDs I initially believed were correct (`UCFwYhL1aQYukmJiEdmmaOA`, `UCrXJi7HUfv04L-TRh0FhtQ`, `UCP7jMXSYQPeANDQ`) -> **HTTP 404**, `content-type: text/html`, `server: YouTube RSS Feeds server`, 1612-byte Google error page "Error 404 (Not Found)!!1".
- Re-resolving **@Fireship** from its live channel page gave `UCsBjURrPoezykLs9EqgamOA` -> **HTTP 200, 15 entries**. So the "Fireship 404" observation is fully explained by a wrong channel id, not by the channel.
- Confidence: **primary** (directly observed).

### C2 — A real, valid channel CAN return HTTP 200 with 0 entries. This is the real anomaly.
- `@BBCBreaking` = `UCpk-QVhA18ARukizFlfY4gg` -> **HTTP 200**, `content-type: text/xml; charset=UTF-8`, body 682 bytes, **zero `<entry>` elements**, but a well-formed `<feed>` with `<id>yt:channel:pk-Q...`.
- The channel's own `/videos` page (`youtube.com/@BBCBreaking/videos`) returns **800,687 bytes with `ytInitialData` present but ZERO `"videoId"` occurrences**, versus 1,213,829 bytes / 210 `videoId`s for @Fireship.
- Implication: the empty RSS feed is **faithful** — the channel exposes no public videos. It is NOT a fetch failure.
- Confidence: **primary**. (Why the channel is empty is **unverified** — defunct/archived/region-restricted/hidden were not distinguishable.)

### C3 — The feed is broadly reliable. 15/18 probed channels returned data.
`@Fireship` 15, `@GoogleDevelopers` 15, `@NBCNews` 15, `@FoxNews` 15, `@AlJazeera` 15,
`@EdSheeran` 15, `@MrBeast` 15, `@Vsauce` 15, `@Nas` **7** (partial), `@Tech` 15,
`@linkedin` 15, `@Netflix` 15, `@Kurzgesagt` 15, `@TED` 15, `@TheCodingTrain` 15,
`@BBCBreaking` **0**, `@CNA`/`@Bloomberg`/`@OfficialStrait`/`@Daily` **handle resolve failed**
(wrong/renamed handles — 404 on the channel page, not a feed problem).
- Confidence: **primary**.

### C4 — Handle resolution via the channel page HTML WORKS unauthenticated. No interstitial.
`https://www.youtube.com/@Fireship` -> HTTP 200, contains `"externalId":"UCsBjURrPoezykLs9EqgamOA"`,
and `consent` appears **0 times** in the HTML (no EU DSA consent wall for this request). This is
our current path and it is sound.
- Confidence: **primary** (single request; region/UA dependent, see F6).

### C5 — The `UU`/`UULF` uploads-playlist trick STILL WORKS. Our code comment is wrong.
`https://www.youtube.com/feeds/videos.xml?playlist_id=UUsBjURrPoezykLs9EqgamOA` -> **HTTP 200, 15 entries**.
`...?playlist_id=UULFsBjURrPoezykLs9EqgamOA` -> **HTTP 200, 15 entries**.
`...?playlist_id=PLsBjURrPoezykLs9EqgamOA` -> HTTP 404 (that PL id is not real, as expected).
- The comment at `src/server/widgets/videos.ts:169-176` states "As of 2024-2025 YouTube returns
  empty/0 entries for that UULF feed for many channels". **Not reproducible on 2026-09-27** for
  @Fireship. It may still be true for some channels, but the blanket claim is stale.
- **CORRECTED by F4 (7 channels x 3 forms):** `UU` and `UULF` are alive but **not distinct
  feeds** — all three forms agreed *exactly* in every row. So they are **NOT a usable second URL**
  for a `channel_id` failure; they fail together. Glance's `UC -> UULF` substitution buys nothing.
- Confidence: **primary** (mine: 1 channel; F4: 7 channels — F4's is the stronger sample).

### C5g — CONFLICT RESOLVED: `UULF` is ALIVE. F5's "404 7/7" is WRONG.
Three observers, two of them on F5's own channel set, with ids resolved via `externalId`:

| observer | channels | `channel_id` | `UULF` |
|---|---|---|---|
| F4 | 7 | 15 | **15 (all)** |
| me, run 1 (Fireship) | 1 | 15 | **15** |
| me, run 2 (3 ch x 3 repeats) | 3 | 15,15,15 | **15,15,15** |
| me, run 3 (F5's exact 7) | 7 | 200/15 all | **200/15 all** |
| F5 | 7 | 15 | **404 (claimed)** |

Run 3 used F5's exact channel list (Fireship, Google, GoogleChrome, Microsoft, veritasium,
3Blue1Brown, mkbhd) with independently resolved ids: **`UULF` returned 200/15 on 7/7.**
F5's own A1 note records that one of its earlier sweeps was corrupted by the decoy-id bug
(`A0`); the `UULF` row almost certainly came from that same corrupted sweep.
**Resolution: `UULF` is served. F5's measurement is rejected; the claim is not carried forward.**
Confidence: **primary**, 4 independent measurements vs 1 rejected.

### C7b — yt-dlp YouTube-breakage rate: F6's numbers REJECTED, mine used instead.
F6 reported closed `site:youtube` + `site-bug` issues as 76 (2024) / 196 (2025) / 117 (2026-01-01..
2026-09-27). I could not reproduce those under any query form. Measured myself via
`https://api.github.com/search/issues` on 2026-09-27:

| query | 2024 | 2025 | 2026-01-01..09-27 |
|---|---|---|---|
| `is:issue is:closed label:site-bug label:site:youtube` | **46** | **103** | **53** |
| `is:issue` (open+closed) both labels | 55 | 122 | 82 |
| `is:issue is:closed label:site-bug` only | — | 531 | 303 |
| open `site:youtube` backlog (current) | — | — | **124** |

The query form changes the answer, so the metric must be stated with its query. Using the first
row: **~4-9 closed YouTube-site issues per month**, a sustained tax. F6's ~13-16/month is rejected
as unreproducible; it overstates the rate by roughly 2x. Qualitative conclusion (chronic breakage
for the hardest possible extractor) stands; magnitude is lower. GitHub search rate limit is
10 req/min unauthenticated and was hit during re-verification, so later rows are single-run.
- Confidence: **primary** (own measurement, query stated).

### C5b — OUR extractor is CORRECT. F1's "decoy UC id" root cause does not apply to us.
Replaying `extractChannelId` from `src/server/widgets/videos.ts:155-167` verbatim (the
`externalId` -> `browseId` -> `channelId` -> `channel_id=` pattern order) against the live HTML of
7 handles, compared to the page's own `<link rel="canonical">`:

| handle | our extractor | canonical | feed |
|---|---|---|---|
| @Fireship | UCsBjURrPoezykLs9EqgamOA | same | 200 / 15 |
| @veritasium | UCHnyfMqiRRG1u-2MsSQLbXA | same | 200 / 15 |
| @mkbhd | UCBJycsmduvYEL83R_U4JriQ | same | 200 / 15 |
| @Vsauce | UC6nSFpj9HTCZ5t-N3Rm3-HA | same | 200 / 15 |
| @Kurzgesagt | UCsXVk37bltHxD1rDPwtNM8Q | same | 200 / 15 |
| @MrBeast | UCX6OQ3DkcsbYNE6H8uQQuVA | same | 200 / 15 |
| @Netflix | UCWOA1ZGywLbqmigxE4Qlvuw | same | 200 / 15 |

7/7 correct, 7/7 feeds populated. The `externalId`-first ordering is what defeats the decoys —
a naive `/UC\w{22}/` first-match does NOT, which is F1's C3 case. **Do not "fix" the extractor
into a simpler regex**; that would introduce the bug rather than remove it.
- Confidence: **primary**.

### C5c — A REAL defect in our chain: handle-resolution failure feeds a handle into `channel_id`.
`feedUrlsForChannels` (`videos.ts:223-231`) catches a `resolveHandleToChannelId` throw and sets
`id = ch` — i.e. the literal string `@Fireship`. `feedUrlForId` then builds
`?channel_id=%40Fireship`, which is **guaranteed HTTP 404** (F1 C4 verified: `@Fireship` as a
literal `channel_id` returns the same generic 404 page as a nonexistent channel). So a transient
handle-page failure is laundered into a feed 404. It is later rescued by the
`source.startsWith('@')` scrape fallback, which is why it presents as "flaky small channels"
rather than as a hard error. The 404 is *manufactured*, not observed from YouTube.
- Confidence: **primary** (code reading + endpoint behaviour both verified).

### C5d — CONFIRMED LANDMINE: the `"channelId"` pattern yields a REAL BUT WRONG channel.
Reconciling F1 (decoy ids) / F2 (first `channelId` match is wrong) / my own replay of the extractor.
Measured 2026-09-27, first match of each pattern vs the page's own canonical:

| handle | `externalId` | `browseId` | `channelId` | canonical |
|---|---|---|---|---|
| @Fireship | MATCH | MATCH | **DIFF** -> `UC2Xd-TjJByJyK2w1zNwY0zQ` = **"Beyond Fireship"** | UCsBjURrPoezykLs9EqgamOA |
| @veritasium | MATCH | MATCH | **DIFF** -> `UCin0m13qWv3-051xlWlHamA` = **"Veritasium en Francais"** | UCHnyfMqiRRG1u-2MsSQLbXA |
| @mkbhd | MATCH | MATCH | **DIFF** -> `UCG7J20LhUeLl6y_Emi7OJrA` = **"The Studio"** | UCBJycsmduvYEL83R_U4JriQ |

The `"channelId"` pattern is a **real, valid, different channel** — not a decoy string. Its feed
returns **HTTP 200 with 15 entries**. So falling through to it does not produce a 404 or an empty
widget; it produces **15 plausible videos from the wrong channel**, indistinguishable from success.
- Today we are safe: `externalId` and `browseId` are checked first and both MATCH canonical.
- The failure mode activates **only if YouTube removes `externalId`/`browseId` from the page** —
  i.e. precisely on a YouTube redesign, the same event that breaks scrapers generally.
- **This violates our own brand law** ("never silently swallow a failure; a silent empty widget is
  the defect we are fixing") in a worse form: not an empty widget, but a *wrong* one.
- Recommended (not implemented here — research only): drop the bare `"channelId"` pattern, and
 cross-check the candidate against `<link rel="canonical" href=".../channel/UC…">` / `og:url`,
 which F1 and I both verified as correct on 7/7 handles. Reject on mismatch instead of accepting.
- Confidence: **primary** (measured, 3/3).

### C5e — Brief premise corrections (repo names were wrong)
`JuanPabloBC/pytubefix`, `dberl/hijs` (youtube-dl-exec) and `google-youtube-api` are **404 /
not found** (verified by F2 via the GitHub API, 2026-09-27). The real repos are
`juanbindez/pytubefix`, `microlinkhq/youtube-dl-exec`. Do not cite the brief's spellings.

### C5f — `youtubei.js` `getChannel()` is broken for handles; `resolveURL()` is the fix
F2: youtubei.js 18.1.0 `src/Innertube.ts:385` passes the raw id straight into
`browseEndpoint.browseId` and never resolves handles — it 400s. yt-dlp's `_tab.py` does the
`resolve_url` hop first. Consistent with my C6. Consequence: **a library can be actively broken for
this exact task while its tests pass**, so "is it maintained" is not the same question as "does it
work".

### C6 — InnerTube is NOT globally PO-token gated, but `@handle` as a `browseId` is REJECTED.
With a freshly harvested public `INNERTUBE_API_KEY` + `visitorData` from the homepage
(`AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8`, clientVersion `2.20260925.01.00`):

| call | result |
|---|---|
| `youtubei/v1/browse` with `browseId:"UCsBjURrPoezykLs9EqgamOA"` | **HTTP 200** |
| `youtubei/v1/browse` + `params:"EgZ2aWRlb3PyBgQKAjoA"` (videos tab) | **HTTP 200**, 210 x 11-char `videoId` in `richItemRenderer` lockups, 0 `videoRenderer` |
| `youtubei/v1/search` `query:"@Fireship"` | **HTTP 200**, returns `browseId:"UCsBjURrPoezykLs9EqgamOA"` — **correct handle->UC resolution, keyless** |
The playlist finding is recorded under C7.
| `youtubei/v1/browse` with `browseId:"@Fireship"` | **HTTP 400 `INVALID_ARGUMENT`** |

- `browseId:"@handle"` returned **400 on every one of 15 client contexts tested**:
  WEB, WEB_REMIX, MWEB, ANDROID, ANDROID_VR, IOS, TVHTML5, TVHTML5_SIMPLY_EMBEDDED_PLAYER,
  WEB_EMBEDDED_PLAYER, WEB_CREATOR, WEB_KIDS, MEDIA_CONNECT_FRONTEND — with 2024 versions
  (reason `failedPrecondition`) *and* with current 2026 versions on WEB/IOS/TVHTML5/ANDROID
  (reason `badRequest`).
- The ANDROID client's specific error is `failedPrecondition` — that is the **PO-token /
  attestation gate**, and it is now the *default* state, not an opt-in.
- **Correction to the premise in the brief:** WEB is not the only working context — the
  real blocker is the *handle-as-browseId request shape*, not the client context.
- Confidence: **primary**.

### C7 — Playlists: RSS feed works; InnerTube `VL<playlistId>` works.
- Real playlist id harvested from `@Fireship/playlists`: `PL0vfts4VzfNh4huPTppuH0FZ0-a_qCMe-`.
- `feeds/videos.xml?playlist_id=PL0vfts4VzfNh4huPTppuH0FZ0-a_qCMe-` -> **HTTP 200, 4,072 bytes**, carries `<yt:playlistId>`, and yielded only **2 `<entry>` elements** ("Alibaba is going all in on Qwen...", "Alibaba is coming for Claude...") where InnerTube returned **20**. The RSS playlist feed is a *recent-additions* feed, not a listing — so a `playlist:` source renders a short list and looks like data loss. **Product-bug surface, not an error.**
- Bogus playlist id `PLZZZ...ZZZ` -> **HTTP 404** (so bad playlist ids are distinguishable).
- InnerTube `browseId:"VLPL0vfts4VzfNh4huPTppuH0FZ0-a_qCMe-"` -> **HTTP 200**, 20 x 11-char
  `videoId`, but **0 `playlistVideoRenderer`** — it is the newer lockup view model.
- Confidence: **primary**.

## Searches / commands
All evidence above is from direct `curl` against youtube.com; no search engine involved.
Reproduce with any `Mozilla/5.0 ... Chrome/120` User-Agent.

## Conflicting evidence
- Our own code comment (UULF dead) conflicts with C5. Resolved in favour of the observation:
  the comment generalizes from an unstated sample and is not reproducible now.
- The brief's premise that "WEB context requires a PO token" conflicts with C6. Resolved: WEB
  browse-by-UC and search work with no token; only `@handle` browse is rejected.

## Gaps
- Whether the empty-@BBCBreaking case is regional, an anti-bot response, or a genuinely
  dead channel — not distinguishable from one request.
- Behaviour from a datacenter/VPS IP (the real deployment target) was NOT tested. A residential
  IP is the most likely place where our conclusions do **not** transfer. See F6.
- Single-sample for `UULF`; not swept across channels.
