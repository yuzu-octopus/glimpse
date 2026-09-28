import { Badge, ClickableCard, Grid, ProgressBar, Stack, Text } from '@astryxdesign/core';
import { ArrowDown, ArrowUp } from 'lucide-react';
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
    <Grid columns={{ minWidth: 110 }} gap={2}>
      {items.map((item) => {
        const meta = [item.subtitle, ageOf(item.date)].filter(Boolean).join(' • ');
        return (
          <ClickableCard
            key={`${item.title}-${item.poster ?? item.url ?? ''}`}
            label={item.title}
            href={item.url ?? undefined}
            target="_blank"
            variant="transparent"
            padding={0}
            data-testid="media-card"
            className={styles.card}
          >
            {item.poster ? (
              <img src={item.poster} alt="" loading="lazy" className={styles.poster} />
            ) : (
              <div className={styles.posterPlaceholder} aria-hidden="true" />
            )}
            <Text type="supporting" maxLines={1} className={styles.title}>
              {item.title}
            </Text>
            {meta ? (
              <Text type="supporting" maxLines={1} className={styles.meta}>
                {meta}
              </Text>
            ) : null}
          </ClickableCard>
        );
      })}
    </Grid>
  );
}

/** Torrent rows with progress bars (qbittorrent, transmission). */
export function TorrentList({ torrents }: { torrents: TorrentItem[] }) {
  return (
    <Stack gap={2}>
      {torrents.map((t) => {
        const pct = Math.round(t.progress * 100);
        // The seeder's rate was fetched and dropped: two bare speeds with no
        // direction read as one, so each carries its arrow.
        const size = formatBytes(t.size);
        const down = formatSpeed(t.downloadSpeed);
        const up = formatSpeed(t.uploadSpeed);
        const eta = formatEta(t.eta);
        return (
          <Stack key={t.name} gap={1} data-testid="torrent-row">
            <Stack direction="horizontal" gap={2}>
              <Text type="body" maxLines={1} className={styles.torrentName}>
                {t.name}
              </Text>
              <Badge variant="neutral" label={t.state} className={styles.badge} data-testid={`torrent-state-${t.state}`} />
            </Stack>
            {/* The kit's bar supplies the track, fill, radius and the
                role="progressbar" this used to hand-roll; the label is sr-only
                because the torrent name above is the real description. */}
            <ProgressBar
              value={pct}
              label={`${t.name} progress`}
              isLabelHidden
              className={styles.fill}
            />
            <Stack direction="horizontal" gap={2} justify="between" vAlign="center">
              <Text type="supporting" hasTabularNumbers>
                {pct}%
              </Text>
              {size || down || up || eta ? (
                <Stack direction="horizontal" gap={2} vAlign="center" className={styles.torrentMeta}>
                  {size ? <Text as="span" type="supporting" hasTabularNumbers>{size}</Text> : null}
                  {down ? (
                    <Text as="span" type="supporting" hasTabularNumbers>
                      <ArrowDown size={12} aria-hidden /> {down}
                    </Text>
                  ) : null}
                  {up ? (
                    <Text as="span" type="supporting" hasTabularNumbers>
                      <ArrowUp size={12} aria-hidden /> {up}
                    </Text>
                  ) : null}
                  {eta ? <Text as="span" type="supporting" hasTabularNumbers>{eta}</Text> : null}
                </Stack>
              ) : null}
            </Stack>
          </Stack>
        );
      })}
    </Stack>
  );
}
