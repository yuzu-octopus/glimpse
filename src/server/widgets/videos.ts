import { VIDEOS_DEFAULTS, videosSchema } from '../../shared/widgets/keyed';
import { fetchText, retryOptionsFrom, type RetryOptions } from './http';
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

function isChannelId(channel: string): boolean {
  return /^UC[A-Za-z0-9_-]{22}$/.test(channel);
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

// Why channel_id and not UULF (glance's UC→UULF playlist trick):
// Glance builds a playlist feed via UULF<id without UC> (the channel's uploads playlist).
// As of 2024-2025 YouTube returns empty/0 entries for that UULF feed for many channels,
// while ?channel_id=UC... remains populated and reliable. We therefore prefer
// https://www.youtube.com/feeds/videos.xml?channel_id=<UC...> directly. Handles (@handle)
// still work data-driven: resolveHandleToChannelId fetches https://www.youtube.com/@handle
// and extracts the UC id via regex on externalId/browseId/channelId, so config stays
// flexible — use UC... for stability or @handle for convenience (e.g. @spokeishere, @Bug-I).
function feedUrlForId(id: string, _includeShorts: boolean): string {
  if (id.startsWith(PLAYLIST_PREFIX)) {
    const pid = id.slice(PLAYLIST_PREFIX.length);
    return `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(pid)}`;
  }
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}`;
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
      const html = await fetchText(ctx, `https://www.youtube.com/${handle}`, {
        headers: { 'User-Agent': YT_UA },
      }, retry);
      const id = extractChannelId(html);
      if (!id) throw new Error(`could not resolve handle ${handle}`);
      ctx.cache.set(cacheKey, id, 24 * 60 * 60 * 1000);
      return id;
    } catch (err) {
      if (stale) return stale;
      throw err;
    }
  });
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
}

async function feedSpecsForChannels(
  ctx: WidgetFetchContext,
  channels: string[],
  includeShorts: boolean,
  retry: RetryOptions,
): Promise<FeedSpec[]> {
  const results = await Promise.all(
    channels.map(async (ch) => {
      let id = ch;
      let source = ch;
      if (!isChannelId(ch)) {
        const handle = ch.startsWith('@') ? ch : `@${ch}`;
        try {
          id = await resolveHandleToChannelId(ctx, handle, retry);
          source = handle;
        } catch {
          id = ch;
        }
      }
      return {
        url: feedUrlForId(id, includeShorts),
        source,
        cacheKey: id,
        pageUrl: videosPageUrl(source),
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
  const html = await fetchText(ctx, pageUrl, { headers: { 'User-Agent': YT_UA } }, retry);
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
  const playlistFeeds = cfg.playlists.map((p): FeedSpec => {
    const pid = p.startsWith(PLAYLIST_PREFIX) ? p : `${PLAYLIST_PREFIX}${p}`;
    return { url: feedUrlForId(pid, includeShorts), source: p, cacheKey: pid, pageUrl: null };
  });
  const feeds: FeedSpec[] = [...channelFeeds, ...playlistFeeds];

  const settled = await Promise.allSettled(
    feeds.map(async ({ url, source, cacheKey, pageUrl }): Promise<SourceOutcome> => {
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
