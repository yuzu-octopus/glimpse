import { describe, expect, it } from 'vitest';
import { immichSchema, jellyfinSchema, qbittorrentSchema, transmissionSchema } from './media';

describe('media widget schemas', () => {
  it('immich requires url, defaults limit, api-key optional (env fallback)', () => {
    expect(immichSchema.safeParse({ type: 'immich' }).success).toBe(false);
    const cfg = immichSchema.parse({ type: 'immich', url: 'https://immich.lab' });
    expect(cfg.limit).toBe(10);
    expect(cfg['api-key']).toBeUndefined();
    expect(immichSchema.parse({ type: 'immich', url: 'https://immich.lab', 'api-key': 'k' })['api-key']).toBe('k');
  });

  it('jellyfin requires url, defaults limit, user-id optional', () => {
    expect(jellyfinSchema.safeParse({ type: 'jellyfin' }).success).toBe(false);
    const cfg = jellyfinSchema.parse({ type: 'jellyfin', url: 'https://jellyfin.lab' });
    expect(cfg.limit).toBe(10);
    expect(cfg['user-id']).toBeUndefined();
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
