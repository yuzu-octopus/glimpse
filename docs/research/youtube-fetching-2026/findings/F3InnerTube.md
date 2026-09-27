# Angle: F3 — InnerTube API (`youtubei/v1/{browse,player,search,navigation/resolve_url}`)

Ground truth sources cloned and read locally at pinned commits:
- `LuanRT/YouTube.js` @ `bad89d2657e88f907011655f199fba9fb615c339` (2026-09-24) — https://github.com/LuanRT/YouTube.js
- `yt-dlp/yt-dlp` @ `c7fb478d21e9e59524befbe23f7801bb267fb880` (2026-09-16) — https://github.com/yt-dlp/yt-dlp
- `TeamNewPipe/NewPipeExtractor` @ `4818304b90fc9b6a3497d7e40b43aedb9a3f7074` (2026-09-21) — https://github.com/TeamNewPipe/NewPipeExtractor

Live probes: executed 2026-09-27 from a **residential/home IP** (NOT a datacenter IP) with **no cookies, no Google account, no OAuth, no Data API key, no PO token**. Source repo = primary; probes = first-party observation of the live endpoint.

---

## Claims

### C1 — There is NO official Google documentation of InnerTube. Ever.
- `site:developers.google.com innertube` → **zero results** (native `web_search`, 2026-09-27).
- The YouTube API Services ToS (https://developers.google.com/youtube/terms/api-services-terms-of-service, "Last updated 2026-09-14 UTC") defines "YouTube API Services" as *"the YouTube Data API service and YouTube Reporting API service"* plus their docs/data/credentials. InnerTube (`youtubei.googleapis.com`, `www.youtube.com/youtubei/`) is **not** in that definition and gets **no licence, no SLA, no quota, and no change-notification rights** from it.
- The Data API v3 is alive: https://developers.google.com/youtube/v3/revision_history — dated entries 2026-09-14 (thumbnail upload limit 2MB→50MB), 2026-09-11 (`snippet.thumbnails.(key)` docs), 2026-07-07, 2026-06-03. Fetched 2026-09-27.
- `github.com/google/YouTubeDataAPI` → **404, repo does not exist** (`gh repo view`, 2026-09-27). Whatever it was, it is gone.
- confidence: **primary** (first-party docs + live HTTP + live GitHub API)
- consequence: everything below is reverse-engineered, version-pinned to a moving target, and carries no contractual stability.

### C2 — PO tokens are a **player/streaming** mechanism. They are NOT required for `browse` or `resolve_url`.
Three independent, dated, primary sources:
1. **yt-dlp's PO Token Guide wiki** (https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide, *"VXsz edited this page **Jul 12, 2026**"*, 6 revisions). Verbatim: *"There are currently **three** cases yt-dlp may require PO Tokens for video downloads… **GVS**: Google Video Server requests (video streaming - https, dash, hls, etc.); **Player**: Innertube `player` requests (fetch video format URLs); **Subs**: Subtitle requests."* The enforcement table is keyed by client for GVS/Subs only.
2. **yt-dlp source** `yt_dlp/extractor/youtube/_base.py` (2026-09-16): every PO-token policy key is `GVS_PO_TOKEN_POLICY`, `PLAYER_PO_TOKEN_POLICY`, or `SUBS_PO_TOKEN_POLICY`. `_extract_context`, `_call_api(ep='browse', …)`, and the whole of `yt_dlp/extractor/youtube/_tab.py` (120 KB, all channel/tab/playlist extraction) contain **zero** `po_token` / `attestation` / `botguard` references. `grep -n "po_token" _tab.py` → empty.
3. **NewPipeExtractor source**: `PoTokenProvider` Javadoc on `YoutubeStreamExtractor.setPoTokenProvider` — *"to obtain poTokens **required for YouTube player requests and streaming URLs**"*. NPE's `YoutubeChannelHelper.resolveChannelId` (handle→UC) sends **no** poToken.
- confidence: **primary**, 3 independent sources
- **Inference (marked as such):** browse-family InnerTube endpoints are not behind PO-token enforcement. Consistent with C3.

### C3 — LIVE PROBE, 2026-09-27: `browse` and `navigation/resolve_url` work with **zero** credentials.
`browse` with a `UC…` id, **no `key=` query param, no `X-YouTube-Client-Name`, no `X-YouTube-Client-Version`, no `Origin`, no cookies**:
```http
POST https://www.youtube.com/youtubei/v1/browse?prettyPrint=false
Content-Type: application/json

{"context":{"client":{"clientName":"WEB","clientVersion":"2.20260708.00.00"}},
 "browseId":"UCsBjURrPoezykLs9EqgamOA"}
```
→ **HTTP 200**, `metadata.channelMetadataRenderer.externalId == "UCsBjURrPoezykLs9EqgamOA"`, `.title == "Fireship"`. Verified in 3 header variants (full / no-client-headers / no-X-*-headers), all 200. confidence: **primary** (live first-party response).

Full 60-request battery from the same host: **40 sequential** (7 956 ms) → 40×200; **20 parallel** (266 ms) → 20×200. **Zero** throttling, zero CAPTCHA, zero attestation challenge, zero bot-guard response. confidence: **primary**. Caveat: residential IP; see G1.

### C4 — **`browseId: "@handle"` is REJECTED with HTTP 400 on every client tested.** The "returns `channelId: null`" rumour is WRONG in mechanism.
Probe, 2026-09-27, 10 clients (WEB, WEB_EMBEDDED_PLAYER, ANDROID, ANDROID_VR, IOS, MWEB, TVHTML5, TVHTML5_SIMPLY, WEB_KIDS, WEB_CREATOR), with and without the InnerTube key:
→ **all HTTP 400**, body `{"error":{"code":400,"message":"Request contains an invalid argument.","errors":[{"reason":"badRequest"}],"status":"INVALID_ARGUMENT"}}`.
Control in the same batch: the **identical request body with `browseId:"UCsBjURrPoezykLs9EqgamOA"` returned HTTP 200 with `metadata.channelMetadataRenderer.externalId == "UCsBjURrPoezykLs9EqgamOA"` and `.title == "Fireship"`** (see C3). So the 400 is caused specifically by the `@`-prefixed `browseId`, not by the request shape, the key, or the headers.

### C5 — **The working handle→UC path is `POST /youtubei/v1/navigation/resolve_url`.** LIVE-PROVEN.
```http
POST https://www.youtube.com/youtubei/v1/navigation/resolve_url?prettyPrint=false
Content-Type: application/json
X-YouTube-Client-Name: 1
X-YouTube-Client-Version: 2.20260708.00.00

Origin: https://www.youtube.com
User-Agent: <desktop Chrome>

{"context":{"client":{"hl":"en","gl":"US","clientName":"WEB",
   "clientVersion":"2.20260708.00.00","userAgent":"…"}},
 "url":"https://www.youtube.com/@Fireship"}
```
→ **HTTP 200**. UC id lives at **`response.endpoint.browseEndpoint.browseId`**; corroborating **`response.endpoint.commandMetadata.webCommandMetadata.webPageType == "WEB_PAGE_TYPE_CHANNEL"`**.
Response top-level `endpoint` keys observed: `browseEndpoint`, `clickTrackingParams`, `commandMetadata`, `trackingParams`. `browseEndpoint.canonicalBaseUrl` was **null** in every probe — do not depend on it. `browseEndpoint.params` present but opaque (`"EgC4AQCSAwDyBgQKAjIA"`).

**Header-minimality, re-verified with a true zero-header probe (2026-09-27):** `resolve_url` returned **200 + `endpoint.browseEndpoint.browseId`** when sent with `Content-Type: application/json` **alone** — no `X-YouTube-Client-Name`, no `X-YouTube-Client-Version`, no `Origin`, no `User-Agent`, no `key=`. Same for `browse` (see C3, C7). Practical note: the request above is the shape to ship, but do **not** ship the bare-minimum version in production — a UA-less request is exactly what bot detectors key on, and this was observed on a residential IP (G1). Send a realistic desktop `User-Agent` + `Origin`; they are free and cost nothing.

Handle battery, 2026-09-27, **all with no key / no cookie / no PO token**:
| input | HTTP | `browseId` | note |
|---|---|---|---|
| `@Fireship` | 200 | UCsBjURrPoezykLs9EqgamOA | |
| `@TheDailyShow` | 200 | UCwWhs_6x42TyRM4Wstoq8HA | |
| `@google` | 200 | UCK8sQmJBp8GCxrOtXWBpyEA | handle ≠ brand name, still fine |
| `@Gronkh` | 200 | UCYJ61XIK64sp6ZFFS8sctxw | |
| `@veritasium` | 200 | UCHnyfMqiRRG1u-2MsSQLbXA | |
| `@MrBeast` | 200 | UCX6OQ3DkcsbYNE6H8uQQuVA | |
| `@nasa` | 200 | UCLA_DiR1FfKNvjuUpBHmylQ | |
| `@TED` | 200 | UCAuUUnT6oDeKwE6v1NGQxug | |
| `@thisdoesnotexistzzz9999` | **404** | — | `error.message = "Requested entity was not found."` |
| `@UCa-vrCLQHviTOVnEKDOdetQ` | **404** | — | UC id sent as a handle → 404 |
| `https://www.youtube.com/@Fireship/videos` | 200 | UCsBjURrPoezykLs9EqgamOA | tab path OK |
| `https://www.youtube.com/channel/UC…` | 200 | UC… | idempotent |
| `https://www.youtube.com/playlist?list=PL…` | 200 | **VL**PL0vfts4VzfNjnYhJMfTulea5McZbQLM7G | playlists come back as `VL`-prefixed |

**404 is a clean, machine-distinguishable "no such channel" signal** — this is the fail-loud hook the dashboard needs. confidence: **primary** (live).

Third-party corroboration of the same design, in source:
- `youtubei.js/src/Innertube.ts:479` — `resolveURL(url)` → `this.actions.execute('/navigation/resolve_url', { url, parse: true })`. `getChannel(id)` (line 385) passes the id **straight** into `browseEndpoint.browseId`; it never resolves handles itself.
- `NewPipeExtractor/.../YoutubeChannelHelper.java:58` `resolveChannelId()` — if the token doesn't start with `UC`, POST to `"navigation/resolve_url"`, retry **up to 3 times** following `urlEndpoint.url` while `webPageType == "WEB_PAGE_TYPE_UNKNOWN"`, and reject with `"Redirected id is not pointing to a channel"` if the final `browseId` doesn't start with `UC`. Source comment: *"@TheDailyShow -> resolves to thedailyshow -> resolves to the id… some handles e.g. @google or @Gronkh directly resolve the id"*.
- confidence: **primary** (2 independent libraries + live probe)

### C6 — Working client matrix for **channel-id extraction**. LIVE-PROVEN 2026-09-27.
`browse` with `browseId:"UCsBjURrPoezykLs9EqgamOA"`, no key / no cookie / no PO token. Versions taken from yt-dlp `_base.py` (2026-09-16) and youtubei.js `Constants.ts` (2026-09-24).

| client | clientName (id) | `browse` | `metadata.channelMetadataRenderer.externalId` | `resolve_url` @Fireship |
|---|---|---|---|---|
| **WEB** | `WEB` (1) | **200** | ✅ `UCsBjURrPoezykLs9EqgamOA` | ✅ 200 |
| **MWEB** | `MWEB` (2) | **200** | ✅ same | ✅ 200 |
| ANDROID | `ANDROID` (3) | 200 | ❌ no `metadata` node (UC id present in body, unstable location) | ✅ 200 |
| IOS | `IOS` (5) | **400** | — | ✅ 200 |
| TVHTML5 | `TVHTML5` (7) | 200 | ❌ no `metadata` | ✅ 200 |
| TVHTML5_SIMPLY | (75) | **400** | — | ✅ 200 |
| TVHTML5_SIMPLY_EMBEDDED_PLAYER | (85) | **400** | — | ✅ 200 |
| WEB_EMBEDDED_PLAYER | (56) | **400** | — | ✅ 200 |
| WEB_KIDS | (76) | 200 | ❌ no `metadata` | ✅ 200 |
| WEB_CREATOR | (62) | **400** | — | **401** (auth required) |
| ANDROID_VR | `ANDROID_VR` (28) | 200 | ❌ no `metadata` | ✅ 200 |
| ANDROID_TESTSUITE | (30) | **400** | — | ✅ 200 |
| VISIONOS | `VISIONOS` (101) | 200 | ❌ no `metadata` | ✅ 200 |
| MEDIA_CONNECT_FRONTEND | (95) | **400** | — | ✅ 200 |
| WEB_REMIX (music host) | `WEB_REMIX` (67) | 200 | ❌ no `metadata` | 200, **no browseId** |

- **No client required a PO token, an API key, or a cookie for any 200 above.**
- **Only WEB and MWEB put the id in `metadata.channelMetadataRenderer.externalId`.** Every other successful client returns a body that contains the UC string but in an unstable location (ANDROID/VISIONOS use `header.pageHeaderRenderer` → EML `pageHeaderViewModel`). **Use WEB or MWEB.**
- ANDROID with a *minimal* context → 400; with a full context (`androidSdkVersion`, `deviceMake`, `deviceModel`, `osName`, `osVersion`, `clientScreen`, `timeZone`, `utcOffsetMinutes`, `platform`, `clientFormFactor`, `originalUrl`) → 200. ANDROID context validation is stricter than WEB's.
- confidence: **primary** (live)

### C7 — Exact working request shape, and which headers actually matter.
Minimum proven-working WEB `browse` request (C3) — zero-header probe re-run 2026-09-27, **5 variants, all HTTP 200 with `externalId` intact**: `{Content-Type only}`, `{Content-Type + User-Agent}`, `{Content-Type + Origin}`, `{NO headers at all}`, `{full header set}`. **No `key=`, no `X-YouTube-Client-Name`, no `X-YouTube-Client-Version`, no `Origin`, no `User-Agent`, no `X-Goog-Visitor-Id`, no cookie** — none of them changes the outcome.
`resolve_url` behaves identically (200 + `endpoint.browseEndpoint.browseId` with `Content-Type` alone).
**Ship the full-shape request anyway** (desktop `User-Agent`, `Origin: https://www.youtube.com`, `X-YouTube-Client-Name: 1`, `X-YouTube-Client-Version`, `Content-Type`). The minimal form is what YouTube *tolerates*, not what it *expects*; a header-less, key-less request is the exact shape reputation systems flag, and G1 is unresolved.
- The `X-YouTube-Client-Name` numeric IDs are published in `youtubei.js/src/utils/Constants.ts` → `CLIENT_NAME_IDS` (`WEB:'1'`, `MWEB:'2'`, `ANDROID:'3'`, `IOS:'5'`, `TVHTML5:'7'`, `WEB_EMBEDDED_PLAYER:'56'`, `WEB_CREATOR:'62'`, `WEB_REMIX:'67'`, `ANDROID_VR:'28'`, `VISIONOS:'101'`, `TVHTML5_SIMPLY:'74'`*(note: yt-dlp sends `75` for `tv_simply` — conflict, see X1)*, `TVHTML5_SIMPLY_EMBEDDED_PLAYER:'85'`, `WEB_KIDS:'76'`, `ANDROID_MUSIC:'21'`, `ANDROID_CREATOR:'14'`).
- The InnerTube key `AIza…<redacted: public InnerTube web constant, see youtube.com/YouTube.js or a maintained client lib>` is a **hardcoded public constant in both libraries** (`youtubei.js Constants.CLIENTS.WEB.API_KEY`, `yt-dlp` via `--extractor-args youtube:innertube_key`). It is a hardcoded public constant, **not a credential you hold**, and **probed as unnecessary** for `browse`. `yt-dlp` only passes `key=` if the user configured one (`_base.py:_call_api`).
- confidence: **primary** (live + 2 source repos)

### C8 — `clientVersion` staleness is tolerated for `browse`; only *unknown/future* versions fail. LIVE-PROVEN 2026-09-27.
Same WEB `browse` request, varying only `clientVersion`:
| clientVersion | HTTP | externalId |
|---|---|---|
| `2.20240101.00.00` (2.5 yrs stale) | **200** | ✅ |
| `2.20250101.00.00` | **200** | ✅ |
| `2.20260623.01.00` | **200** | ✅ |
| `2.20260708.00.00` (current) | **200** | ✅ |
| `2.99999999.99.99` | **404** | ❌ |
| `banana` | **404** | ❌ |
| `2.0` | **404** | ❌ |
- confidence: **primary** (live)
- **[inference]** For `browse`/`resolve_url` a hardcoded client version is low-risk; for `player` it is not (see C9). Don't over-engineer version rotation for channel resolution.

### C9 — `player` is where the gating is. LIVE-PROVEN 2026-09-27 (no key, no cookie, no PO token):
| client | `playabilityStatus.status` | reason | formats | adaptiveFormats |
|---|---|---|---|---|
| WEB | **UNPLAYABLE** | "Video unavailable" | 0 | 0 |
| WEB_EMBEDDED_PLAYER | **ERROR** | "This video is unavailable" | 0 | 0 |
| TVHTML5 | **UNPLAYABLE** | "The page needs to be reloaded." | 0 | 0 |
| **ANDROID** (21.26.364, full ctx) | **OK** | — | 1 | **29** |
(`videoId: dQw4w9WgXcQ`)
- The ANDROID `player` response carries **30 format URLs with no PO token at all** — consistent with yt-dlp's policy `PLAYER_PO_TOKEN_POLICY: PlayerPoTokenPolicy(required=False, recommended=True)` for android. What yt-dlp marks `GVS required=True` is the **subsequent fetch of the googlevideo URL**, not the `player` call. Not tested here (out of scope).
- confidence: **primary** (live)

### C10 — Dated history of the PO-token regime in yt-dlp (full `git log -S` on `_base.py`).
| date | commit | what |
|---|---|---|
| 2025-05-18 | `2685654a3` `[ie/youtube] Add a PO Token Provider Framework (#12840)` | first `yt_dlp/extractor/youtube/pot/provider.py` |
| 2025-07-11 | `5b57b72c1` `#15726`-series "Do not require PO Token for premium account" | first `class GvsPoTokenPolicy`; `GVS_PO_TOKEN_POLICY` introduced |
| 2025-09-26 | `12b57d285` | "Replace `tv_simply` with `web_safari` in defaults" |
| 2026-01-29 | `309b03f2a` "Fix default player clients (#15726)" | add `ios_downgraded`, remove `android_sdkless` |
| 2026-07-20 | `69ea20006` "Player client maintenance (#17261)" | adds source comment *"**Since 2026.07**, intermittent/selective POT enforcement has been observed for non-HLS formats"*; adds the word *"trusted"*; adds `visionos` to logged-out defaults |
| 2026-08-18 | `dae52d838` "Remove `android_vr` from default clients (#17461)" | source comment *"**Since 2026.08.17**, ALL formats (including live HLS and itag 18) are 403'd with version 1.65.10"* |
| 2026-08/09 | also in `_base.py` | *"Since 2026.07, HLS formats are only returned with some logged-in or 'trusted' sessions"* (web_safari comment) |
confidence: **primary** (git history of the reference implementation, verbatim commit comments)

### C11 — Dated, first-party evidence of a 2026 bot-detection spike — and it is `/player` only.
- `LuanRT/YouTube.js` issue **#1119**, *"v16.0.1 - LOGIN_REQUIRED bot detection blocking videoDetails on clients"*, **created 2026-01-15T18:59:33Z, closed 2026-01-15T23:55:47Z** (https://github.com/LuanRT/YouTube.js/issues/1119). Verbatim body: *"YouTube is returning 'Sign in to confirm you're not a bot' for **the /player endpoint**… This affects **WEB, ANDROID, iOS, and WEB_EMBEDDED** clients."* Workaround: `yt.getInfo(id, { client: 'TV_EMBEDDED' })`. **No mention of `browse` or channel resolution.**
- `yt-dlp` issue **#16087**, *"yt-dlp is forcing `web` client for `v1/next` requests"*, **opened 2026-02-28** (https://github.com/yt-dlp/yt-dlp/issues/16087). Symptom `ERROR - Request contains an invalid argument.` / HTTP 400 on **`v1/next` (initial data)**, workaround `youtube:player_skip=initial_data`. `v1/next` is the player-adjacent continuation endpoint, not `browse`.
- confidence: **primary** (issue tracker, fetched via `gh`, not summarised)

### C12 — Where maintainers keep the authoritative client list (Q5).
1. **`youtubei.js` — the list is in source, not in a doc.** [`src/utils/Constants.ts`](https://github.com/LuanRT/YouTube.js/blob/main/src/utils/Constants.ts) (commit `bad89d2`, 2026-09-24) exports `CLIENTS` (name, version, UA, device model, os), `CLIENT_NAME_IDS` (numeric ids), and `SUPPORTED_CLIENTS`. Currently: `WEB 2.20260623.01.00`, `IOS 20.11.6`, `MWEB 2.20260205.04.01`, `WEB_KIDS 2.20260205.00.00`, `ANDROID 21.03.36` (SDK 36), `ANDROID_VR 1.65.10`, `VISIONOS 1.02`, `TV 7.20260311.12.00`, `TV_SIMPLY 1.0`, `TV_EMBEDDED 2.0`, `WEB_EMBEDDED 1.20260206.01.00`, `WEB_CREATOR 1.20241203.01.00`. Type union: `src/types/Misc.ts:4` — `export type InnerTubeClient = 'IOS' | 'WEB' | 'MWEB' | 'ANDROID' | 'ANDROID_VR' | 'VISIONOS' | 'YTMUSIC' | 'YTMUSIC_ANDROID' | 'YTSTUDIO_ANDROID' | 'TV' | 'TV_SIMPLY' | 'TV_EMBEDDED' | 'YTKIDS' | 'WEB_EMBEDDED' | 'WEB_CREATOR';` (there is **no** `InnetubeClientType` enum and **no** `src/core/clients/Web.ts`/`Android.ts` — the brief's expected paths do not exist; `src/core/clients/` contains only `Kids.ts`, `Music.ts`, `Studio.ts`, `index.ts`).
   - **Full context object is built in** [`src/core/Session.ts:592 #buildContext`](https://github.com/LuanRT/YouTube.js/blob/main/src/core/Session.ts): keys `hl, gl, remoteHost, screenDensityFloat, screenHeightPoints, screenPixelDensity, screenWidthPoints, visitorData, clientName, clientVersion, osName, osVersion, userAgent, platform, clientFormFactor, userInterfaceTheme, timeZone, originalUrl, deviceMake, deviceModel, browserName, browserVersion, utcOffsetMinutes, memoryTotalKbytes, rolloutToken, deviceExperimentId, mainAppWebInfo{graftUrl, pwaInstallabilityStatus}`. Per-client overrides in [`src/utils/HTTPClient.ts:206 #adjustContext`](https://github.com/LuanRT/YouTube.js/blob/main/src/utils/HTTPClient.ts).
   - **Cadence** (`git log -- src/utils/Constants.ts`): 8 bumps in 2025, 7 in 2026 (2026-02-08, 2026-03-03, 2026-03-14, 2026-03-15, 2026-03-16, 2026-06-23 `chore(constants): Bump WEB client version`, 2026-08-13). Roughly **monthly-to-quarterly, manual, PR-reviewed**. Not automated, not scraped.
2. **yt-dlp** — [`yt_dlp/extractor/youtube/_base.py` `INNERTUBE_CLIENTS`](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/_base.py) (commit `c7fb478`, 2026-09-16), 11 clients (`web`, `web_safari`, `web_embedded`, `web_music`, `web_creator`, `android`, `android_vr`, `ios`, `visionos`, `mweb`, `tv`, `tv_downgraded`, `tv_simply`), each carrying its own `GVS/PLAYER/SUBS_PO_TOKEN_POLICY`. Maintained by `bashonly` in "Player client maintenance" PRs (#15726, #17261, #17461).
3. **NewPipeExtractor** — [`ClientsConstants.java`](https://github.com/TeamNewPipe/NewPipeExtractor/blob/master/extractor/src/main/java/org/schabi/newpipe/extractor/services/youtube/ClientsConstants.java): WEB `2.20260805.01.00`, WEB_REMIX `1.20260804.16.00`, VISIONOS `1.04`, plus `WEB_MUSIC_ANALYTICS` (31).
- **Three independent implementations converge on: WEB / MWEB / TVHTML5 / ANDROID / IOS are the live set, and versions are hand-bumped every few weeks.** confidence: **primary**.

### C13 — What the authoritative sources say about PO tokens, verbatim.
- yt-dlp PO Token Guide (edited 2026-07-12): *"Proof of Origin (PO) Token is a parameter that YouTube requires to be sent with requests from **some clients**. Without it, requests for the affected clients' **format URLs** may return HTTP Error 403, or result in your account or IP address being blocked."* … *"A PO Token is generated by an attestation provider on Web, Android and iOS platforms to attest the requests are coming from a genuine client."* … *"A PO Token is generated by either BotGuard (Web), DroidGuard (Android), iOSGuard (iOS). A PO Token from one platform cannot be used on another."* … *"PO Tokens have a 'content binding'… bound to the user session (Visitor ID or account Session ID) or to the video ID."*
- Enforcement table (verbatim, abridged): `web` → "Subs, GVS"; `mweb` → "GVS"; `tv` → "Not required"; `tv_simply` → "GVS"; `web_embedded` → "Not required"; `android` → "GVS or Player"; `android_vr` → "Not required"; `ios` → "GVS or Player".
- confidence: **primary**

### C14 — Channel-id extraction node (Q4), in library source.
- `yt-dlp`: `_tab.py:684` — `channel_id = traverse_obj(metadata_renderer, ('externalId', {self.ucid_or_none}), ('channelUrl', {self.ucid_from_url}))` on `data.metadata.channelMetadataRenderer`, with fallback `ucid_from_url`. `_base.py:621` `_YT_CHANNEL_UCID_RE = r'UC[\w-]{22}'`.
- `youtubei.js`: `src/parser/classes/Channel.ts:24` — `this.id = data.channelId;` (populated by the parser from the browse response metadata).
- confidence: **primary**

### C15 — New channel-feed node shape (browsing UC…/videos).
Live WEB `browse` with `{"browseId":"UC…","params":"EgZ2aWRlb3PyBgQKAjoA"}` → 200, `contents.twoColumnBrowseResultsRenderer.tabs[]` = `Home, Videos, Shorts, Live, Shows, Courses, Playlists, Posts`. The `Videos` tab is at **index 1**, `tabRenderer.content.richGridRenderer.contents[]` = 31 items (Fireship). Each item is `richItemRenderer.content.lockupViewModel` — keys `contentImage, metadata, contentId, contentType, themedPalette, rendererContext`, e.g. `contentId: "c1rPlzxSZ8E"`, `contentType: "LOCKUP_CONTENT_TYPE_VIDEO"`, title at `metadata.lockupMetadataViewModel.title.content`. **No `videoRenderer` / `richItemRenderer.videoRenderer` any more** — a parser written against the old shape silently yields 0 videos. confidence: **primary** (live).
- Note the `params` blob is a base64 protobuf (`EgZ2aWRlb3PyBgQKAjoA` = tab "Videos"); browsing the bare `UC…` with **no** `params` returns the same tab list but defaults to the Home tab content. [inference from the two probes]

### C16 — Playlist / uploads-playlist browseIds, live 2026-09-27.
| browseId | HTTP | result |
|---|---|---|
| `VL` + real `PL…` | **200** | `metadata.playlistMetadataRenderer` present; items parse |
| `PL…` (no `VL`) | **400** | INVALID_ARGUMENT |
| `UUXsBjURrPoezykLs9EqgamOA` (uploads of Fireship) | **400** | INVALID_ARGUMENT — **the UULF trick is dead at the InnerTube level for the WEB client** |
- Caution: an earlier probe of mine used a made-up `PLrEnWoR732-CN09YykVg` and got 400 for `VL…` too; re-running with a real id from the channel's own Playlists tab returned 200. **400 on `VL…` means "bad or unauthorised playlist id", not "browse is broken".** Do not over-read 400. confidence: **primary** (live, self-corrected).
- Relevant to Glance's `UC → UULF` behaviour: the empirical 400 corroborates the reference implementation's own comment that UULF is unreliable.

### C17 — Rate limits, documented.
yt-dlp YouTube Extractor wiki (https://github.com/yt-dlp/yt-dlp/wiki/Extractors, fetched 2026-09-27), verbatim: *"With the default yt-dlp settings, the rate limit for guest sessions is ~**300 videos/hour (~1000 webpage/player requests per hour)**. For accounts, it is ~2000 videos/hour (~4000 webpage/player requests per hour)."* And: *"`This content isn't available, try again later` … is caused by your YouTube guest session or account exceeding the YouTube video request rate limit."* → these bounds are stated for **video/webpage/player** requests. **No published limit exists for `browse`/`resolve_url`** (C1: no docs at all).
Live corroboration: 60 `browse` calls (40 serial + 20 parallel) in <9 s → 0 throttling (C3). confidence: **primary** for the quoted yt-dlp figures; **unverified** for `browse` specifically.

---

## Searches
Tool: native `web_search`, `gh search issues` (authenticated `gh`), `gh repo view`, `gh issue view`, local `git log -S` on full clones, live `fetch` probes, direct `read <url>`.
- `web_search`: `yt-dlp github issue "Request contains an invalid argument" browseId channel 2026`
- `web_search`: `YouTube.js github issue 2026 PO token required browse channel resolve handle`
- `web_search`: `site:developers.google.com youtube innertube API documentation internal` → 0 results
- `web_search`: `site:developers.google.com innertube` → **0 results** (confirms C1)
- `web_search`: `"youtube data api" v3 deprecated 2026 shutdown announcement developers.google.com`
- `gh search issues --repo LuanRT/YouTube.js "invalid argument"` (15 hits, all upload/player/metadata — **none** about handle browse)
- `gh search issues --repo yt-dlp/yt-dlp "Request contains an invalid argument"` (25 hits, newest 2026-02-28 #16087)
- `gh issue view 1119 --repo LuanRT/YouTube.js`
- `gh search issues --repo TeamNewPipe/NewPipeExtractor "invalid argument"` / `"po token OR poToken"` → 0 relevant
- `gh repo view google/YouTubeDataAPI` → 404
- `git log -S` (yt-dlp, full history): `GvsPoTokenPolicy`, `GVS_PO_TOKEN_POLICY`, `WEB_PO_TOKEN_POLICIES`, `trusted`, `intermittent/selective POT enforcement`, `ALL formats (including live HLS and itag 18) are 403`, `navigation/resolve_url`
- `git log` (youtubei.js, full history): `-- src/utils/Constants.ts` (cadence), `-S "resolveURL" -- src/Innertube.ts` (added 2022-12-31, commit `#268`)
- grep across all three repos for `browseId` + `@` → 0 hits
- Live probes: ~110 InnerTube requests across 15 client contexts and 4 endpoints

---

## Conflicting evidence
- **X1 — `TVHTML5_SIMPLY` client id: 74 vs 75.** `youtubei.js/src/utils/Constants.ts` `CLIENT_NAME_IDS.TVHTML5_SIMPLY = '74'`; `yt-dlp/_base.py` `'tv_simply'` → `'INNERTUBE_CONTEXT_CLIENT_NAME': 75`. **Resolution:** the `X-YouTube-Client-Name` header id and the body's `clientName` are separate things; they are not required to match for these endpoints (C7 shows the header is optional entirely). Since `browse` 400s for this client either way, it is moot for us. **Do not copy the id from either library without re-testing.**
- **X2 — "ANDROID browse works" vs "ANDROID browse 400s".** First probe (minimal context) → 400; second (full context) → 200. **Resolution: ANDROID validates more context fields.** Not a client-availability difference. Both are true.
- **X3 — "`@handle` browse returns `channelId: null`" (task premise / circulating report) vs my observed hard 400.** **Resolution: the mechanism claim is wrong for the WEB client as probed on 2026-09-27.** Either (a) the report describes an older YouTube state, (b) it describes a downstream parse of a *different* client, or (c) it is an LLM-fabricated detail. I could find **zero** primary evidence for the `null` behaviour in any of the three issue trackers. **Flag as unverified; do not build on it.**
- **X4 — yt-dlp's own numbers vs my numbers.** yt-dlp: guest ≈ 1000 webpage/player requests/hour. Me: 60 `browse` in 9 s. **No conflict — different endpoint classes.** But it does *not* prove `browse` is unmetered; see G2.
- **X5 — `resolve_url` for a `VL`-prefixed playlist works, but the *same* endpoint returns no `browseId` on the WEB_REMIX (music) host.** Not a conflict — different host/route table.
- **X6 — `MEDIA_CONNECT_FRONTEND` (id 95) is not in any of the three maintained client lists.** I probed it anyway: `browse` → 400, `resolve_url` → 200. Listed here for completeness, not recommended.

---

## Gaps
- **G1 — Datacenter IP is UNTESTED.** Every live probe here came from a **residential/home** connection. The task's actual deployment is a datacenter IP with no Google account, no cookies, no proxy rotation. yt-dlp's wiki explicitly warns that missing PO Tokens can cause *"your account or **IP address** being blocked"*, and the 2026-07-20 yt-dlp comment uses the word *"trusted"*, and the PO Token Guide lists the Invidious "YouTube Trusted Session Generator" as a tool — which is strong circumstantial evidence that IP/session reputation is now a live variable. **I cannot verify InnerTube browse behaviour from a datacenter IP from here.** The single highest-value follow-up is to re-run the two C3/C5 requests from the actual deployment host. Everything else in this file is client-shaped, not IP-shaped, and should hold; but the 60-request burst in C3 may not.
- **G2 — No published rate limit or quota for `browse`/`resolve_url` exists** (C1). My 60-request burst is one data point on one IP. Treat "no throttling observed" as **unverified** for production volumes.
- **G3 — I did not test the `googlevideo` (GVS) fetch**, so I cannot say what a PO token buys you in practice or whether a datacenter IP gets 403'd on stream URLs. Out of scope for this angle; the `player` call itself demonstrably needs no token (C9).
- **G4 — Since-when for the `@handle` → 400 rejection is UNKNOWN.** No issue in any of the three trackers documents it, and no library ever sent it, so there is no regression window to date. I can state it is broken *now*; I cannot state when it broke.
- **G5 — The `X-YouTube-Client-Name` id table disagrees between youtubei.js and yt-dlp (X1)** and I only spot-probed a few. Treat the whole table as unverified per-entry.
- **G6 — `TVHTML5_SIMPLY_EMBEDDED_PLAYER` (85) and `ANDROID_TESTSUITE` (30) versions are guesses** (`2.0`, `1.9`); neither appears in any maintained list with those versions. Their 400s may be my bad versions, not client rejection. **Unverified.**
- **G7 — Non-ASCII handles untested.** My one non-ASCII attempt (`@аsports` with a Cyrillic `а`) correctly 404'd, but I did not test a genuinely non-Latin *valid* handle. Ironic given the Glance context; flagged for F5/F6.
- **G8 — `botguard`/attestation challenge path never observed.** No probe returned a `bg_challenge` / `botguardResponse`. That is consistent with browse not being gated, but I did not attempt to *force* a challenge (e.g. hammering), so I cannot say the endpoint is incapable of issuing one.
