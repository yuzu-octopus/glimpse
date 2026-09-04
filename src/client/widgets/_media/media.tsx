import type { MediaItem, TorrentItem } from '../../../shared/widgets/payloads';
import styles from './media.module.css';

function formatBytes(n: number | null): string | null {
  if (n == null) return null;
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[u]}`;
}

function formatSpeed(bps: number | null): string | null {
  const s = formatBytes(bps);
  return s ? `${s}/s` : null;
}

function formatEta(secs: number | null): string | null {
  if (secs == null) return null;
  if (secs < 60) return `${secs}s left`;
  if (secs < 3600) return `${Math.round(secs / 60)}m left`;
  return `${Math.round(secs / 3600)}h left`;
}

function ageOf(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

/** Poster-card grid for recently-added library items (immich, jellyfin). */
export function MediaGrid({ items }: { items: MediaItem[] }) {
  return (
    <div className={styles.grid}>
      {items.map((item) => {
        const meta = [item.subtitle, ageOf(item.date)].filter(Boolean).join(' • ');
        return (
          <a
            key={`${item.title}-${item.poster ?? item.url ?? ''}`}
            href={item.url ?? undefined}
            target="_blank"
            rel="noreferrer"
            className={styles.card}
            data-testid="media-card"
          >
            {item.poster ? (
              <img src={item.poster} alt="" loading="lazy" className={styles.poster} />
            ) : (
              <div className={styles.posterPlaceholder} aria-hidden="true" />
            )}
            <span className={styles.title}>{item.title}</span>
            {meta ? <span className={styles.meta}>{meta}</span> : null}
          </a>
        );
      })}
    </div>
  );
}

/** Torrent rows with progress bars (qbittorrent, transmission). */
export function TorrentList({ torrents }: { torrents: TorrentItem[] }) {
  return (
    <div className={styles.torrents}>
      {torrents.map((t) => {
        const pct = Math.round(t.progress * 100);
        const meta = [formatBytes(t.size), formatSpeed(t.downloadSpeed), formatEta(t.eta)].filter(Boolean).join(' • ');
        return (
          <div key={t.name} className={styles.torrent} data-testid="torrent-row">
            <div className={styles.torrentHead}>
              <span className={styles.torrentName}>{t.name}</span>
              <span className={styles.badge} data-testid={`torrent-state-${t.state}`}>{t.state}</span>
            </div>
            <div className={styles.bar} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${t.name} progress`}>
              <div className={styles.fill} style={{ width: `${pct}%` }} />
            </div>
            <div className={styles.torrentMeta}>
              <span>{pct}%</span>
              {meta ? <span>{meta}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
