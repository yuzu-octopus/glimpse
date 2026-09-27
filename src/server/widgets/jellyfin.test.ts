import { describe, expect, it, vi } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './jellyfin';
import type { MediaData } from '../../shared/widgets/payloads';
import { jellyfinSchema } from '../../shared/widgets/media';

const USERS_FIXTURE = [{ Id: 'user1', Name: 'admin' }];
const LATEST_FIXTURE = [
  { Id: 'm1', Name: 'Dune', Type: 'Movie', ProductionYear: 2021 },
  { Id: 'e1', Name: 'Pilot', Type: 'Episode', SeriesName: 'Severance', SeasonName: 'Season 1', IndexNumber: 1, PremiereDate: '2022-02-18T00:00:00Z' },
];

function makeCtx(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>, env: Record<string, string | undefined> = {}): WidgetFetchContext {
  return {
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
    env,
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const fetcher = () => serverWidgets.get('jellyfin')!;

function router(url: string): Response {
  if (url.endsWith('/Users')) return new Response(JSON.stringify(USERS_FIXTURE), { status: 200 });
  return new Response(JSON.stringify(LATEST_FIXTURE), { status: 200 });
}

describe('jellyfin fetcher', () => {
  it('resolves the user then maps latest items with episode subtitles', async () => {
    const ctx = makeCtx(async (url) => router(url), { JELLYFIN_API_KEY: 'k' });
    const data = (await fetcher()(ctx, { type: 'jellyfin', url: 'https://jellyfin.lab' })) as MediaData;
    expect(data.items).toHaveLength(2);
    expect(data.items[0]).toEqual({
      title: 'Dune',
      subtitle: 'Movie',
      poster: 'https://jellyfin.lab/Items/m1/Images/Primary?maxWidth=300&quality=80',
      url: 'https://jellyfin.lab/web/index.html#!/details?id=m1',
      date: '2021',
    });
    expect(data.items[1].subtitle).toBe('Severance · Season 1 E1');
  });

  it('uses an explicit user-id and the env api key', async () => {
    const seen: string[] = [];
    const inits: RequestInit[] = [];
    const ctx = makeCtx(async (url, init) => { seen.push(url); inits.push(init ?? {}); return router(url); }, { JELLYFIN_API_KEY: 'env-key' });
    await fetcher()(ctx, { type: 'jellyfin', url: 'https://jellyfin.lab', 'user-id': 'u9' });
    expect(seen.some((u) => u.includes('/Users/u9/Items/Latest'))).toBe(true);
    expect(seen.some((u) => u.endsWith('/Users'))).toBe(false);
    expect(inits[0].headers).toMatchObject({ 'X-Emby-Token': 'env-key' });
  });

  it('ignores an api-key left in the config and throws when the env is empty', async () => {
    const inits: RequestInit[] = [];
    const ctx = makeCtx(async (url, init) => { inits.push(init ?? {}); return router(url); }, { JELLYFIN_API_KEY: 'env-key' });
    await fetcher()(ctx, { type: 'jellyfin', url: 'https://jellyfin.lab', 'user-id': 'u9', 'api-key': 'leaked' });
    expect(inits[0].headers).toMatchObject({ 'X-Emby-Token': 'env-key' });
    expect('api-key' in jellyfinSchema.parse({ type: 'jellyfin', url: 'https://jellyfin.lab', 'api-key': 'leaked' })).toBe(false);
    const missing = makeCtx(async (url) => router(url));
    await expect(fetcher()(missing, { type: 'jellyfin', url: 'https://jellyfin.lab' })).rejects.toThrow(/JELLYFIN_API_KEY/);
  });
});
