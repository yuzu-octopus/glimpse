import { VIDEOS_DEFAULTS, videosSchema } from '../../shared/widgets/keyed';
import { fetchText } from './http';
import { registerWidget } from './registry';
import type { Video } from '../../shared/widgets/payloads';
import type { WidgetFetchContext } from './registry';
import { STATIC_TTL_MS } from '../../shared/live';

function getBXML(): { parse(s: string): unknown } {
  const b = (globalThis as unknown as { Bun?: { XML?: { parse(s: string): unknown } } }).Bun?.XML;
  if (b) return b;
  // vitest/jsdom fallback via DOMParser
  return { parse: fallbackXmlParse };
}

function fallbackXmlParse(xml: string): unknown {
  const DP = (globalThis as unknown as { DOMParser?: new () => { parseFromString(s: string, t: string): Document } }).DOMParser;
  if (!DP) throw new Error('Bun.XML not available and DOMParser missing');
  const doc = new DP().parseFromString(xml, 'text/xml');
  const root = doc.documentElement;
  if (!root) return {};
  const out: Record<string, unknown> = {};
  out[root.tagName] = domToObj(root);
  return out;
}

function domToObj(el: Element): unknown {
  const obj: Record<string, unknown> = {};
  for (const attr of Array.from(el.attributes)) obj[`@${attr.name}`] = attr.value;
  const children = Array.from(el.children);
  if (children.length === 0) {
    const text = el.textContent?.trim() ?? '';
    if (Object.keys(obj).length === 0) return text || '';
    if (text) obj['#text'] = text;
    return obj;
  }
  for (const child of children) {
    const val = domToObj(child);
    const key = child.tagName;
    if (key in obj) {
      const existing = obj[key];
      if (Array.isArray(existing)) (existing as unknown[]).push(val);
      else obj[key] = [existing, val];
    } else obj[key] = val;
  }
  return obj;
}

const YT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PLAYLIST_PREFIX = 'playlist:';

function isChannelId(channel: string): boolean {
  return /^UC[A-Za-z0-9_-]{22}$/.test(channel);
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
      });
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

async function feedUrlsForChannels(
  ctx: WidgetFetchContext,
  channels: string[],
  includeShorts: boolean,
): Promise<Array<{ url: string; source: string; cacheKey: string }>> {
  const results = await Promise.all(
    channels.map(async (ch) => {
      let id = ch;
      let source = ch;
      if (!isChannelId(ch)) {
        const handle = ch.startsWith('@') ? ch : `@${ch}`;
        try {
          id = await resolveHandleToChannelId(ctx, handle);
          source = handle;
        } catch {
          id = ch;
        }
      }
      return { url: feedUrlForId(id, includeShorts), source, cacheKey: id };
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

registerWidget('videos', async (ctx, config) => {
  const cfg = videosSchema.parse(config);
  const includeShorts = cfg['include-shorts'] ?? false;

  const channelFeeds = await feedUrlsForChannels(ctx, cfg.channels, includeShorts);
  const playlistFeeds = cfg.playlists.map((p) => {
    const pid = p.startsWith(PLAYLIST_PREFIX) ? p : `${PLAYLIST_PREFIX}${p}`;
    return { url: feedUrlForId(pid, includeShorts), source: p, cacheKey: pid };
  });
  const feeds = [...channelFeeds, ...playlistFeeds];

  const settled = await Promise.allSettled(
    feeds.map(async ({ url, source, cacheKey }) => {
      const fullCacheKey = `videos:feed:${cacheKey}::${cfg['video-url-template'] ?? ''}::${includeShorts ? 'shorts' : 'noshorts'}`;
      // TtlCache.set retains a stale copy for 24h internally, so one key suffices.
      const getCached = (): Video[] | undefined =>
        ctx.cache.get<Video[]>(fullCacheKey) ?? ctx.cache.getStale<Video[]>(fullCacheKey);
      const setCached = (videos: Video[]) => {
        ctx.cache.set(fullCacheKey, videos, STATIC_TTL_MS);
      };
      try {
        let raw = await fetchText(ctx, url, { headers: { 'User-Agent': YT_UA } });
        let parsed = parseVideoFeed(raw);
        // Fallback for handles that return 0 entries (YouTube flakiness for small MC channels): try handle /videos page scrape
        if (parsed.items.length === 0 && source.startsWith('@')) {
          try {
            const html = await fetchText(ctx, `https://www.youtube.com/${source}/videos`, { headers: { 'User-Agent': YT_UA } });
            const ids = [...html.matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g)].map((m) => m[1]);
            const seenIds = new Set<string>();
            const fallbackItems: Array<Record<string, unknown>> = [];
            for (const vid of ids) {
              if (seenIds.has(vid)) continue;
              seenIds.add(vid);
              // Need title — try to extract nearby title, fallback to vid
              const titleMatch = html.match(new RegExp(`"videoId":"${vid}"[^}]*"title":\\{"runs":\\[\\{"text":"([^"]+)"`, 's'));
              fallbackItems.push({
                title: titleMatch ? titleMatch[1] : vid,
                link: `https://www.youtube.com/watch?v=${vid}`,
                published: null,
                'media:group': { 'media:thumbnail': { '@url': `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` } },
              } as unknown as Record<string, unknown>);
              if (fallbackItems.length >= 15) break;
            }
            if (fallbackItems.length > 0) {
              parsed = { title: source, items: fallbackItems };
            }
          } catch {
            // ignore fallback error, keep original empty
          }
        }
        const videos = parsed.items.flatMap((item) => {
          let link = '';
          const rawLink = (item as Record<string, unknown>).link;
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
          if (!includeShorts && link.includes('/shorts/')) return [];
          const isoDate =
            (typeof item.published === 'string' ? item.published : undefined) ??
            (typeof item.pubDate === 'string' ? item.pubDate : undefined) ??
            (typeof item.updated === 'string' ? item.updated : undefined) ??
            (typeof item.isoDate === 'string' ? item.isoDate : undefined) ??
            null;
          let thumb: string | null = null;
          const mg = (item as Record<string, unknown>)['media:group'] as Record<string, unknown> | undefined;
          if (mg) {
            const mt = mg['media:thumbnail'] as unknown;
            if (mt && typeof mt === 'object' && typeof (mt as Record<string, unknown>)['@url'] === 'string')
              thumb = (mt as Record<string, unknown>)['@url'] as string;
            else if (Array.isArray(mt) && mt[0] && typeof (mt[0] as Record<string, unknown>)['@url'] === 'string')
              thumb = (mt[0] as Record<string, unknown>)['@url'] as string;
          }
          if (!thumb) {
            const enc = (item as Record<string, unknown>).enclosure as Record<string, unknown> | undefined;
            if (enc && typeof enc['@url'] === 'string') thumb = enc['@url'] as string;
          }
          let title = '';
          const t = (item as Record<string, unknown>).title;
          if (typeof t === 'string') title = t;
          else if (t && typeof t === 'object' && typeof (t as Record<string, unknown>)['#text'] === 'string')
            title = (t as Record<string, unknown>)['#text'] as string;

          return [
            {
              title,
              url: videoUrlFor(link, cfg['video-url-template']),
              channel: parsed.title ?? source,
              published: isoDate,
              thumbnail: thumb,
            } as Video,
          ];
        });
        setCached(videos);
        return videos;
      } catch (err) {
        // Try handle /videos scrape fallback for @handles before giving up
        if (source.startsWith('@')) {
          try {
            const html = await fetchText(ctx, `https://www.youtube.com/${source}/videos`, { headers: { 'User-Agent': YT_UA } });
            const ids = [...html.matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g)].map((m) => m[1]);
            const seenIds = new Set<string>();
            const fallback: Video[] = [];
            for (const vid of ids) {
              if (seenIds.has(vid)) continue;
              seenIds.add(vid);
              const titleMatch = html.match(new RegExp(`"videoId":"${vid}"[^}]*"title":\\{"runs":\\[\\{"text":"([^"]+)"`, 's'));
              fallback.push({
                title: titleMatch ? titleMatch[1] : vid,
                url: `https://www.youtube.com/watch?v=${vid}`,
                channel: source,
                published: null,
                thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
              } as unknown as Video);
              if (fallback.length >= 15) break;
            }
            if (fallback.length > 0) {
              setCached(fallback);
              return fallback;
            }
          } catch {
            // ignore
          }
        }
        const cached = getCached();
        if (cached) return cached;
        throw err;
      }
    }),
  );

  const videos: Video[] = [];
  const seen = new Set<string>();
  for (const r of settled) {
    if (r.status === 'fulfilled') {
      for (const v of r.value) {
        if (!seen.has(v.url)) {
          seen.add(v.url);
          videos.push(v);
        }
      }
    }
  }
  videos.sort((a, b) => {
    const ta = a.published ? Date.parse(a.published) : 0;
    const tb = b.published ? Date.parse(b.published) : 0;
    return tb - ta;
  });

  const limit = cfg.limit ?? VIDEOS_DEFAULTS.limit;
  return { videos: videos.slice(0, limit) };
});
