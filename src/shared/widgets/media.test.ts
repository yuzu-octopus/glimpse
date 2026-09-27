import { describe, expect, it } from 'vitest';
import { immichSchema, jellyfinSchema, qbittorrentSchema, transmissionSchema } from './media';

describe('media widget schemas', () => {
  it('immich requires url, defaults limit, and takes no api-key', () => {
    expect(immichSchema.safeParse({ type: 'immich' }).success).toBe(false);
    const cfg = immichSchema.parse({ type: 'immich', url: 'https://immich.lab' });
    expect(cfg.limit).toBe(10);
    // The config reaches the browser verbatim, so a leftover `api-key:` is
    // stripped rather than passed through to the page payload.
    const withKey = immichSchema.parse({ type: 'immich', url: 'https://immich.lab', 'api-key': 'k' });
    expect(withKey['api-key']).toBeUndefined();
    expect(JSON.stringify(withKey)).not.toContain('k');
  });

  it('jellyfin requires url, defaults limit, keeps user-id, takes no api-key', () => {
    expect(jellyfinSchema.safeParse({ type: 'jellyfin' }).success).toBe(false);
    const cfg = jellyfinSchema.parse({ type: 'jellyfin', url: 'https://jellyfin.lab' });
    expect(cfg.limit).toBe(10);
    expect(cfg['user-id']).toBeUndefined();
    expect(jellyfinSchema.parse({ type: 'jellyfin', url: 'https://jellyfin.lab', 'user-id': 'u9' })['user-id']).toBe('u9');
    // A user id is not a secret; an api key is, and the config goes to the browser.
    const withKey = jellyfinSchema.parse({ type: 'jellyfin', url: 'https://jellyfin.lab', 'api-key': 'leaked' });
    expect(withKey['api-key']).toBeUndefined();
    expect(JSON.stringify(withKey)).not.toContain('leaked');
  });

  it('qbittorrent requires url, credentials optional (env fallback)', () => {
    expect(qbittorrentSchema.safeParse({ type: 'qbittorrent' }).success).toBe(false);
    const cfg = qbittorrentSchema.parse({ type: 'qbittorrent', url: 'http://qb.lab:8080' });
    expect(cfg.limit).toBe(10);
    expect(cfg.username).toBeUndefined();
  });

  it('transmission requires url, credentials optional (env fallback)', () => {
    expect(transmissionSchema.safeParse({ type: 'transmission' }).success).toBe(false);
    const cfg = transmissionSchema.parse({ type: 'transmission', url: 'http://tr.lab:9091' });
    expect(cfg.limit).toBe(10);
  });
});
