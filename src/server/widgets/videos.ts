import { VIDEOS_DEFAULTS, videosSchema } from '../../shared/widgets/keyed';
import { fetchText, fetchWithRetry, retryOptionsFrom, type RetryOptions } from './http';
import { registerWidget } from './registry';
import type { Video, VideoSourceIssue, VideosData } from '../../shared/widgets/payloads';
import type { WidgetFetchContext } from './registry';
import { STATIC_TTL_MS } from '../../shared/live';
import { getBXML } from './xml';

const YT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const FALLBACK_LIMIT = 15;
const YTDATA_MARKERS = ['var ytInitialData = ', 'window["ytInitialData"] = ', 'ytInitialData = '];

/** Legacy channel-grid renderers, all of which carry `videoId` + `title`. */
const RENDERER_ID_KEYS: Record<string, true> = {
  videoRenderer: true,
  gridVideoRenderer: true,
  compactVideoRenderer: true,
  playlistVideoRenderer: true,
  reelItemRenderer: true,
};

/** A YouTube video id is exactly 11 url-safe base64 chars. Used both to pick
 * real videos out of the channel page and — the regression guard — to reject
 * any title that is really just an id that leaked through as a title. */
function isVideoId(value: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(value.trim());
}

/** Read a YouTube text node in every documented shape: `{content}` (lockup
 * view models), `{simpleText}`, `{runs:[{text}]}` (older video renderers) and
 * bare strings. Node keys change when YouTube redesigns; the text shape does
 * not, so walk the keys instead of pinning one renderer. */
function readText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(readText).join('');
  if (!node || typeof node !== 'object') return '';
  const obj = node as Record<string, unknown>;
  for (const key of ['content', 'simpleText', 'text', 'runs']) {
    if (obj[key] === undefined) continue;
    const text = readText(obj[key]);
    if (text) return text;
  }
  return '';
}

/** Index of the `}` closing the `{` at `start`, string-literal aware. */
function matchBraces(src: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return -1;
}

/** YouTube ships the whole channel page as one `ytInitialData` JSON blob. */
function extractYtInitialData(html: string): unknown {
  for (const marker of YTDATA_MARKERS) {
    const at = html.indexOf(marker);
    if (at === -1) continue;
    const start = html.indexOf('{', at + marker.length);
    if (start === -1) continue;
    const end = matchBraces(html, start);
    if (end === -1) continue;
    try {
      return JSON.parse(html.slice(start, end + 1)) as unknown;
    } catch {
      // malformed blob (truncated page, consent interstitial) — try the next marker
    }
  }
  return null;
}

/** Parse a channel's /videos page into feed-shaped items.
 *
 * The previous fallback regex-matched `"videoId":"X"[^}]*"title":{"runs":[{"text":"`.
 * YouTube moved the channel grid to `lockupViewModel` (title under
 * `metadata.lockupMetadataViewModel.title.content`), the regex stopped matching,
 * and every row rendered its bare video id as the title. So parse the embedded
 * JSON and read whichever renderer is present instead.
 *
 * Throws when the page carries no `ytInitialData` blob at all. A redesign, a
 * consent wall or a 404 stub must read as a broken scraper, not as a channel
 * with nothing to show — the throw is what the caller turns into a visible
 * per-source failure.
 */
export function parseChannelPage(html: string): {
  title?: string;
  items: Array<Record<string, unknown>>;
} {
  const data = extractYtInitialData(html);
  // No blob means the page is not the page we think it is: a consent wall, a
  // 404 stub, or a redesign that moved the grid. Returning `{items: []}` here
  // is what made a broken scraper indistinguishable from a quiet channel, so
  // this is a hard throw and the caller reports it as a source failure.
  if (!data || typeof data !== 'object') {
    throw new Error(`markup changed: no ytInitialData (${html.length} bytes)`);
  }

  const found: Array<{ videoId: string; title: string }> = [];
  const seen = new Set<string>();
  let channel: string | undefined;

  const add = (videoId: string, title: string) => {
    if (seen.has(videoId)) return;
    seen.add(videoId);
    found.push({ videoId, title });
  };

  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const renderer = value as Record<string, unknown>;
      if (key === 'channelMetadataRenderer' || key === 'microformatDataRenderer') {
        channel ??= readText(renderer.title) || undefined;
      } else if (key === 'lockupViewModel') {
        const id = renderer.contentId;
        const meta = renderer.metadata as Record<string, unknown> | undefined;
        const lockupMeta = meta?.lockupMetadataViewModel as Record<string, unknown> | undefined;
        if (typeof id === 'string' && isVideoId(id)) add(id, readText(lockupMeta?.title));
      } else if (RENDERER_ID_KEYS[key] === true) {
        const id = renderer.videoId;
        if (typeof id === 'string' && isVideoId(id)) add(id, readText(renderer.title));
      }
      visit(value);
    }
  };
  visit(data);

  // A video whose title could not be resolved is dropped, never rendered as its
 // own id — an 11-char id in the title slot is the bug, not a fallback.
  const items = found
    .filter((v) => v.title !== '' && !isVideoId(v.title))
    .slice(0, FALLBACK_LIMIT)
    .map((v) => ({
      title: v.title,
      link: `https://www.youtube.com/watch?v=${v.videoId}`,
      published: null,
      'media:group': { 'media:thumbnail': { '@url': `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg` } },
    }));
  return { title: channel, items };
}

const PLAYLIST_PREFIX = 'playlist:';

/** A channel id is `UC` + 22 url-safe base64 chars, but a config value that
 * starts with `UC` is a channel id someone mistyped — not a handle to resolve.
 * Asking the handle resolver about one produced `channel_id=UC1`, a URL that
 * can never answer, so the decision is by shape and not by validity. */
function looksLikeChannelId(value: string): boolean {
  return value.startsWith('UC');
}

/** The public page a source can be scraped from when its feed comes back
 * empty. A handle and a raw `UC…` both have one — gating the fallback on
 * `@handle` meant a channel configured by id had no second channel at all and
 * simply vanished whenever its RSS feed died. Each path segment is encoded on
 * its own; the whole path never is. */
function videosPageUrl(source: string): string | null {
  if (source.startsWith('@')) return `https://www.youtube.com/${encodeURIComponent(source)}/videos`;
  if (source.startsWith('UC')) return `https://www.youtube.com/channel/${encodeURIComponent(source)}/videos`;
  return null;
}

/** A channel id is `UC` + 22 url-safe base64 chars. */
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

/** The `UC…` the page names in its JSON, `externalId` first. The ordering is
 * load-bearing, not incidental: a `@handle` page carries 17 distinct `UC…`
 * strings, and the loose `channelId` pattern lands on a *real but different*
 * channel whose feed answers 200 with 15 plausible wrong videos — silent
 * wrong content, which is worse than the empty widget this widget was fixed
 * to stop rendering. Verified correct 7/7 against the page canonical
 * (docs/research/youtube-fetching-2026/REPORT.md, finding 2). */
export function extractChannelId(html: string): string | null {
  const patterns = [
    /"externalId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/,
    /"browseId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/,
    /"channelId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/,
    /channel_id=(UC[A-Za-z0-9_-]{22})/,
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m) return m[1];
  }
  return null;
}

/** The `UC…` the page states about itself in `<link rel="canonical">` or
 * `og:url` — identity from the document, not from a JSON field a redesign can
 * repoint. Attribute order is not relied on: the tag is matched, then its
 * `href`/`content` is read.
 *
 * null means "this page states no channel id", which is NOT a mismatch — a
 * handle page can canonicalise to its `/@handle` form. Only two ids that
 * disagree are a rejection. */
export function extractCanonicalChannelId(html: string): string | null {
  const tag =
    /<link\b[^>]*\brel=["']canonical["'][^>]*>/i.exec(html)?.[0] ??
    /<meta\b[^>]*\bproperty=["']og:url["'][^>]*>/i.exec(html)?.[0];
  const url = tag ? /\b(?:href|content)=["']([^"']+)["']/i.exec(tag)?.[1] : undefined;
  if (!url) return null;
  return (
    /\/channel\/(UC[A-Za-z0-9_-]{22})/.exec(url)?.[1] ??
    /[?&]channel_id=(UC[A-Za-z0-9_-]{22})/.exec(url)?.[1] ??
    null
  );
}

/** The page scrape, gated on the page agreeing with itself: a candidate the
 * canonical/og:url contradicts is rejected, not returned. The extractor alone
 * is only correct while YouTube keeps shipping `externalId`, and the one event
 * that drops it is exactly the redesign that breaks scrapers generally
 * (docs/research/youtube-fetching-2026/REPORT.md, finding 2). */
function channelIdFromPage(html: string): string {
  const candidate = extractChannelId(html);
  if (!candidate) throw new Error('the page carried no channel id');
  const canonical = extractCanonicalChannelId(html);
  if (canonical && canonical !== candidate) {
    throw new Error('the page canonical names another channel');
  }
  return candidate;
}

// Why channel_id and not UULF (glance's UC→UULF playlist trick):
// Glance builds a playlist feed via UULF<id without UC> (the channel's uploads playlist).
// As of 2024-2025 YouTube returns empty/0 entries for that UULF feed for many channels,
// while ?channel_id=UC... remains populated and reliable. We therefore prefer
// https://www.youtube.com/feeds/videos.xml?channel_id=<UC...> directly. Handles (@handle)
// still work data-driven, so config stays flexible — use UC... for stability or
// @handle for convenience (e.g. @spokeishere, @Bug-I).
// Handles (@handle) resolve through InnerTube's resolve_url first and the
// channel page second — see resolveViaInnerTube for why that order.
function feedUrlForId(id: string, _includeShorts: boolean): string {
  if (id.startsWith(PLAYLIST_PREFIX)) {
    const pid = id.slice(PLAYLIST_PREFIX.length);
    return `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(pid)}`;
  }
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}`;
}

const RESOLVE_URL =
  'https://www.youtube.com/youtubei/v1/navigation/resolve_url?prettyPrint=false';
/** A pinned WEB client version. Proven keyless on 2026-09-27; the research
 * calls a hardcoded version low-risk for resolution, so no rotation
 * machinery is warranted. */
const WEB_CLIENT_VERSION = '2.20260708.00.00';

const HANDLE_TTL_MS = 24 * 60 * 60 * 1000;

/** resolve_url's answer, in the two shapes it is read in: the documented
 * `response.-`-wrapped one and the top-level one. */
interface ResolveEndpoint {
  endpoint?: { browseEndpoint?: { browseId?: unknown } };
  response?: ResolveEndpoint;
}

/** resolve_url answered, and answered "no such thing". Kept distinct from
 * every other failure because it is the one that must not be rescued: a
 * handle YouTube cannot resolve has no channel page to scrape either, so the
 * second request could only ever be another 404. */
class HandleNotFound extends Error {}

/** Why this order, and not the other way round: resolve_url is keyless, it
 * returns the id YouTube itself would browse, and its 404 body is the only
 * unambiguous bad-config signal in the whole chain. The channel-page scrape
 * stays as the fallback because yt-dlp's initial-data extraction was still an
 * unmerged fix on 2026-09-27 — the scrape is our resilience when InnerTube
 * changes, not our first choice
 * (docs/research/youtube-fetching-2026/REPORT.md, findings 1, 3 and 4). */
async function resolveViaInnerTube(
  ctx: WidgetFetchContext,
  handle: string,
  retry: RetryOptions,
): Promise<string> {
  const body = JSON.stringify({
    context: {
      client: {
        hl: 'en',
        gl: 'US',
        clientName: 'WEB',
        clientVersion: WEB_CLIENT_VERSION,
        userAgent: YT_UA,
      },
    },
    url: `https://www.youtube.com/${handle}`,
  });
  let res: Response;
  try {
    res = await fetchWithRetry(
      ctx,
      RESOLVE_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': YT_UA,
          'Origin': 'https://www.youtube.com',
          'X-YouTube-Client-Name': '1',
          'X-YouTube-Client-Version': WEB_CLIENT_VERSION,
        },
        body,
      },
      retry,
    );
  } catch (err) {
    // `{"error":{"message":"Requested entity was not found."}}` on 404 is the
    // signal; everything else (400 on a changed contract, 5xx, a network
    // blip) is an outage the scrape may still survive.
    if (reasonFor(err) === 'HTTP 404') {
      throw new HandleNotFound(err instanceof Error ? err.message : String(err));
    }
    throw err;
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new Error('resolve_url returned an unreadable body');
  }
  // The report documents the id at `response.endpoint.browseEndpoint.browseId`.
  // Every live probe from this host on 2026-09-27 — 7/7 handles, on
  // www.youtube.com and youtubei.googleapis.com, with and without
  // `prettyPrint=false` — put it at the TOP level instead, with the same ids
  // the report's own table lists. Both shapes are read, because reading only
  // the documented one silently demotes the primary to the scrape.
  //
  // A 200 that carries no `UC…` in either is unresolved, not an empty string:
  // the research is explicit that this shape must fail loudly (REPORT.md,
  // "Failing loudly"). Defaulting it would send `channel_id=` to the feed and
  // manufacture a 404 of our own.
  const shapes: unknown[] = [payload, (payload as ResolveEndpoint)?.response];
  for (const shape of shapes) {
    const browseId = (shape as ResolveEndpoint)?.endpoint?.browseEndpoint?.browseId;
    if (typeof browseId === 'string' && CHANNEL_ID_RE.test(browseId)) return browseId;
  }
  throw new Error('resolve_url returned no channel id');
}

/** The fallback channel: the handle's own page. No retry budget of its own —
 * the resolve already spent the configured one, and a handle that needs
 * rescuing should cost one look, not a second full backoff ladder. The same
 * rule the feed's page rescue follows. */
async function resolveViaChannelPage(
  ctx: WidgetFetchContext,
  handle: string,
  retry: RetryOptions,
): Promise<string> {
  const html = await fetchText(
    ctx,
    `https://www.youtube.com/${handle}`,
    { headers: { 'User-Agent': YT_UA } },
    { ...retry, retries: 0 },
  );
  return channelIdFromPage(html);
}

async function resolveHandleToChannelId(
  ctx: WidgetFetchContext,
  rawHandle: string,
  retry: RetryOptions,
): Promise<string> {
  const handle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;
  const cacheKey = `videos:handle:${handle.toLowerCase()}`;
  const cached = ctx.cache.get<string>(cacheKey);
  if (cached) return cached;
  const stale = ctx.cache.getStale<string>(cacheKey);
  return ctx.singleflight.run(cacheKey, async () => {
    const cached2 = ctx.cache.get<string>(cacheKey);
    if (cached2) return cached2;
    try {
      const id = await resolveViaInnerTube(ctx, handle, retry);
      ctx.cache.set(cacheKey, id, HANDLE_TTL_MS);
      return id;
    } catch (resolveErr) {
      if (resolveErr instanceof HandleNotFound) {
        if (stale) return stale;
        throw resolveErr;
      }
      try {
        const id = await resolveViaChannelPage(ctx, handle, retry);
        ctx.cache.set(cacheKey, id, HANDLE_TTL_MS);
        return id;
      } catch (scrapeErr) {
        if (stale) return stale;
        // The scrape went last, so its reason is the honest one to report: a
        // 404 there is the same "no such channel" the resolve would have
        // said, and a broken scraper names the failure better than the
        // InnerTube error that sent us to it.
        throw scrapeErr;
      }
    }
  });
}

/** Why a handle could not be turned into a feedable id. A 404 is a typo or a
 * channel that no longer exists and gets said in those words; anything else
 * (a 5xx, a consent wall that hid the id) is a resolution failure and is
 * reported as one, because "handle not found" would be a guess. */
function handleFailure(handle: string, err: unknown): string {
  const reason = reasonFor(err);
  return reason === 'HTTP 404' ? `handle not found: ${handle}` : `could not resolve ${handle}: ${reason}`;
}

/** One configured source, resolved to everything the fetch needs: the RSS
 * feed, the page to scrape when that feed is empty, and the config string a
 * diagnostic must name. */
interface FeedSpec {
  source: string;
  url: string;
  cacheKey: string;
  /** null when we have no page to fall back to for this source */
  pageUrl: string | null;
  /** set when the config value could not be resolved to a feedable id at all */
  resolveError?: string;
}

async function feedSpecsForChannels(
  ctx: WidgetFetchContext,
  channels: string[],
  includeShorts: boolean,
  retry: RetryOptions,
): Promise<FeedSpec[]> {
  const results = await Promise.all(
    channels.map(async (ch) => {
      const isId = looksLikeChannelId(ch);
      // Named the way YouTube spells it, resolved or not, so the diagnostic
      // points at the handle the user has to fix.
      const source = isId ? ch : ch.startsWith('@') ? ch : `@${ch}`;
      let id = ch;
      let resolveError: string | undefined;
      if (!isId) {
        try {
          id = await resolveHandleToChannelId(ctx, source, retry);
        } catch (err) {
          // The old `catch { id = ch }` sent the raw handle to
          // `channel_id=@typo` — a URL that cannot possibly answer — so a
          // misspelt handle read as a quiet widget. Say what is wrong instead.
          resolveError = handleFailure(source, err);
        }
      }
      return {
        url: feedUrlForId(id, includeShorts),
        source,
        cacheKey: id,
        pageUrl: videosPageUrl(source),
        resolveError,
      };
    }),
  );
  return results;
}

function videoUrlFor(link: string, template: string | undefined): string {
  if (!template) return link;
  try {
    const id = new URL(link).searchParams.get('v') ?? '';
    if (!id) return link;
    return template.replace('{VIDEO-ID}', id).replace('{VIDEO-URL}', link);
  } catch {
    return link;
  }
}

function parseVideoFeed(raw: string): { title?: string; items: Array<Record<string, unknown>> } {
  const parsed = getBXML().parse(raw) as Record<string, unknown>;
  const feed = parsed.feed as Record<string, unknown> | undefined;
  if (feed) {
    const rawTitle = feed.title;
    const title = typeof rawTitle === 'string' ? rawTitle : (rawTitle as Record<string, unknown> | undefined)?.['#text'] as string | undefined;
    const rawEntries = feed.entry;
    const entries = rawEntries == null ? [] : Array.isArray(rawEntries) ? rawEntries : [rawEntries];
    return { title: title as string | undefined, items: entries as Array<Record<string, unknown>> };
  }
  const rss = parsed.rss as Record<string, unknown> | undefined;
  if (rss) {
    const channel = rss.channel as Record<string, unknown> | undefined;
    if (channel) {
      const rawTitle = channel.title;
      const title = typeof rawTitle === 'string' ? rawTitle : undefined;
      const rawItems = channel.item;
      const items = rawItems == null ? [] : Array.isArray(rawItems) ? rawItems : [rawItems];
      return { title: title as string | undefined, items: items as Array<Record<string, unknown>> };
    }
  }
  return { title: undefined, items: [] };
}

/** One feed item -> one Video. Returns null when the item cannot produce a
 * real title: an empty title or a bare 11-char video id is the bug this guards,
 * so the entry is dropped rather than rendered. */
function toVideo(
  item: Record<string, unknown>,
  channel: string,
  opts: { template: string | undefined; includeShorts: boolean },
): Video | null {
  let title = '';
  const t = item.title;
  if (typeof t === 'string') title = t;
  else if (t && typeof t === 'object' && typeof (t as Record<string, unknown>)['#text'] === 'string')
    title = (t as Record<string, unknown>)['#text'] as string;
  if (title === '' || isVideoId(title)) return null;

  let link = '';
  const rawLink = item.link;
  if (typeof rawLink === 'string') link = rawLink;
  else if (rawLink && typeof rawLink === 'object') {
    const o = rawLink as Record<string, unknown>;
    if (typeof o['@href'] === 'string') link = o['@href'] as string;
    else if (Array.isArray(rawLink)) {
      for (const l of rawLink as unknown[]) {
        if (l && typeof l === 'object' && typeof (l as Record<string, unknown>)['@href'] === 'string') {
          link = (l as Record<string, unknown>)['@href'] as string;
          break;
        }
      }
    }
  }
  if (!opts.includeShorts && link.includes('/shorts/')) return null;

  const isoDate =
    (typeof item.published === 'string' ? item.published : undefined) ??
    (typeof item.pubDate === 'string' ? item.pubDate : undefined) ??
    (typeof item.updated === 'string' ? item.updated : undefined) ??
    (typeof item.isoDate === 'string' ? item.isoDate : undefined) ??
    null;
  let thumb: string | null = null;
  const mg = item['media:group'] as Record<string, unknown> | undefined;
  if (mg) {
    const mt = mg['media:thumbnail'] as unknown;
    if (mt && typeof mt === 'object' && typeof (mt as Record<string, unknown>)['@url'] === 'string')
      thumb = (mt as Record<string, unknown>)['@url'] as string;
    else if (Array.isArray(mt) && mt[0] && typeof (mt[0] as Record<string, unknown>)['@url'] === 'string')
      thumb = (mt[0] as Record<string, unknown>)['@url'] as string;
  }
  if (!thumb) {
    const enc = item.enclosure as Record<string, unknown> | undefined;
    if (enc && typeof enc['@url'] === 'string') thumb = enc['@url'] as string;
  }

  return {
    title,
    url: videoUrlFor(link, opts.template),
    channel,
    published: isoDate,
    thumbnail: thumb,
  };
}

/** The second channel, for any source whose RSS feed comes back empty or
 * fails outright: YouTube still serves an empty `videos.xml` for many small
 * channels and playlists, while the channel's own /videos page carries the
 * same grid as embedded JSON.
 *
 * Throws instead of returning null — an HTTP failure, a 404 page, or markup we
 * can no longer read all have to reach the caller as a reason the widget can
 * show. A silent null is what let a dead source look like a quiet one. */
async function scrapeChannelPage(
  ctx: WidgetFetchContext,
  pageUrl: string,
  retry: RetryOptions,
): Promise<{ title?: string; items: Array<Record<string, unknown>> }> {
  // The rescue gets no retry budget of its own. The feed has already spent the
  // configured one, and a source that is down should cost one look, not two
  // full backoff ladders — that doubles the worst-case latency of a dead
  // source for half a second of extra odds. A blip is covered by the stale
  // cache and by the next poll.
  const html = await fetchText(ctx, pageUrl, { headers: { 'User-Agent': YT_UA } }, { ...retry, retries: 0 });
  return parseChannelPage(html);
}

/** `HTTP 404 for https://…` is the one shape fetchWithRetry throws, so the
 * status is worth keeping and the URL is not — the widget names the source. */
function reasonFor(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const status = /^HTTP (\d{3})\b/.exec(msg)?.[1];
  if (status) return `HTTP ${status}`;
  return msg.length > 60 ? `${msg.slice(0, 57)}…` : msg;
}

/** Every channel answered but none of them produced a video. */
const NO_VIDEOS = 'no videos found';

/** What one source contributed: its videos, and — when it contributed none —
 * why, so the widget can say so instead of looking merely quiet. */
interface SourceOutcome {
  videos: Video[];
  issue?: VideoSourceIssue;
}

registerWidget('videos', async (ctx, config) => {
  const cfg = videosSchema.parse(config);
  const includeShorts = cfg['include-shorts'] ?? false;
  const retry = retryOptionsFrom(cfg);

  const channelFeeds = await feedSpecsForChannels(ctx, cfg.channels, includeShorts, retry);
  // A playlist is a source like any other: `playlist:` is prefixed for the
  // feed, and the public playlist page is its second channel, so a feed that
  // 404s or comes back empty no longer costs the whole source.
  const playlistFeeds = cfg.playlists.map((p): FeedSpec => {
    const pid = p.startsWith(PLAYLIST_PREFIX) ? p.slice(PLAYLIST_PREFIX.length) : p;
    const prefixed = `${PLAYLIST_PREFIX}${pid}`;
    return {
      url: feedUrlForId(prefixed, includeShorts),
      source: p,
      cacheKey: prefixed,
      pageUrl: `https://www.youtube.com/playlist?list=${encodeURIComponent(pid)}`,
    };
  });
  const feeds: FeedSpec[] = [...channelFeeds, ...playlistFeeds];

  const settled = await Promise.allSettled(
    feeds.map(async ({ url, source, cacheKey, pageUrl, resolveError }): Promise<SourceOutcome> => {
      const fullCacheKey = `videos:feed:${cacheKey}::${cfg['video-url-template'] ?? ''}::${includeShorts ? 'shorts' : 'noshorts'}`;
      // TtlCache.set retains a stale copy for 24h internally, so one key suffices.
      const getCached = (): Video[] | undefined =>
        ctx.cache.get<Video[]>(fullCacheKey) ?? ctx.cache.getStale<Video[]>(fullCacheKey);
      const setCached = (videos: Video[]) => {
        ctx.cache.set(fullCacheKey, videos, STATIC_TTL_MS);
      };
      const opts = { template: cfg['video-url-template'], includeShorts };
      const mapItems = (items: Array<Record<string, unknown>>, channel: string) =>
        items.flatMap((item) => toVideo(item, channel, opts) ?? []);
      // An unresolvable handle gets no feed request at all: `channel_id=@typo`
      // is a URL that cannot answer, so asking only turns one 404 into two.
      // Whatever we last knew for it still renders — with the typo named.
      if (resolveError) {
        return { videos: getCached() ?? [], issue: { source, reason: resolveError } };
      }
      try {
        const raw = await fetchText(ctx, url, { headers: { 'User-Agent': YT_UA } }, retry);
        let parsed = parseVideoFeed(raw);
        let reason = NO_VIDEOS;
        // Empty feed: the channel/playlist page still has the grid. If that
        // page is what failed, its reason is the honest one to report.
        if (parsed.items.length === 0 && pageUrl) {
          try {
            parsed = await scrapeChannelPage(ctx, pageUrl, retry);
          } catch (err) {
            reason = reasonFor(err);
          }
        }
        const videos = mapItems(parsed.items, parsed.title ?? source);
        setCached(videos);
        return videos.length === 0 ? { videos, issue: { source, reason } } : { videos };
      } catch (err) {
        if (pageUrl) {
          try {
            const scraped = await scrapeChannelPage(ctx, pageUrl, retry);
            const fallback = mapItems(scraped.items, scraped.title ?? source);
            if (fallback.length > 0) {
              setCached(fallback);
              return { videos: fallback };
            }
          } catch {
            // the page failed too — the feed's error is the one worth naming
          }
        }
        const cached = getCached();
        if (cached) return { videos: cached };
        return { videos: [], issue: { source, reason: reasonFor(err) } };
      }
    }),
  );

  const videos: Video[] = [];
  const issues: VideoSourceIssue[] = [];
  const seen = new Set<string>();
  const seenIssues = new Set<string>();
  const report = (issue: VideoSourceIssue): void => {
    // The same source listed twice in one config is one problem, not two dots.
    const id = `${issue.source} ${issue.reason}`;
    if (seenIssues.has(id)) return;
    seenIssues.add(id);
    issues.push(issue);
  };
  settled.forEach((r, i) => {
    if (r.status === 'rejected') {
      // Nothing in the mapper rethrows, so this is a bug rather than an
      // upstream failure — name the source instead of dropping it.
      report({ source: feeds[i]?.source ?? 'unknown', reason: reasonFor(r.reason) });
      return;
    }
    if (r.value.issue) report(r.value.issue);
    for (const v of r.value.videos) {
      if (!seen.has(v.url)) {
        seen.add(v.url);
        videos.push(v);
      }
    }
  });
  videos.sort((a, b) => {
    const ta = a.published ? Date.parse(a.published) : 0;
    const tb = b.published ? Date.parse(b.published) : 0;
    return tb - ta;
  });

  const limit = cfg.limit ?? VIDEOS_DEFAULTS.limit;
  return { videos: videos.slice(0, limit), issues } satisfies VideosData;
});
