import type { ReactNode } from 'react';
import type { WidgetType } from '../../../shared/config';
import type { MediaData, MediaItem, TorrentData, TorrentItem } from '../../../shared/widgets/payloads';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './media.module.css';

/** The config fields the four media widgets actually render; the rest of each
 * schema is fetcher-side. */
type MediaShellConfig = {
  title?: string;
  'title-url'?: string;
  'hide-header'?: boolean;
  'css-class'?: string;
  'show-errors'?: boolean;
};

/** Payload readers — the only place the media half and the torrent half of the
 * family differ in shape. */
export const pickItems = (data: unknown): MediaItem[] =>
  (data as MediaData | null)?.items ?? [];
export const pickTorrents = (data: unknown): TorrentItem[] =>
  (data as TorrentData | null)?.torrents ?? [];

/**
 * immich, jellyfin, qbittorrent and transmission are one widget: the same
 * loading → empty → rows flow over the same chrome. They differ only in the
 * default title, the empty-state text, which payload key holds the rows, and
 * how a row is drawn — so those four facts are the entire definition.
 * Registers the result under `type`, like every other widget module.
 *
 * Lives here, not beside the row renderers in `media.tsx`, because it is a
 * factory and those are components: `media.tsx` stays pure JSX so it is the
 * only file in the pair that can be read as a component library. It takes the
 * row renderer as an argument rather than importing one, so the pair does not
 * import each other.
 */
export function defineMediaWidget<T extends MediaItem | TorrentItem>(
  type: WidgetType,
  def: {
    defaultTitle: string;
    emptyText: string;
    pick: (data: unknown) => T[];
    render: (rows: T[]) => ReactNode;
  },
) {
  function MediaWidget({ config, data, error, isLoading }: WidgetComponentProps) {
    const cfg = config as unknown as MediaShellConfig;
    const rows = def.pick(data);
    const chrome = {
      title: cfg.title ?? def.defaultTitle,
      titleUrl: cfg['title-url'],
      hideHeader: cfg['hide-header'],
      cssClass: cfg['css-class'],
    };
    if (isLoading ?? ((data as unknown) == null && !error)) {
      return <WidgetChrome {...chrome} isLoading />;
    }
    if (rows.length === 0 && !error) {
      return (
        <WidgetChrome {...chrome}>
          <div className={styles.placeholder}>{def.emptyText}</div>
        </WidgetChrome>
      );
    }
    return (
      <WidgetChrome {...chrome} error={error} showErrors={cfg['show-errors']}>
        {def.render(rows)}
      </WidgetChrome>
    );
  }
  registerWidgetComponent(type, MediaWidget);
  return MediaWidget;
}
