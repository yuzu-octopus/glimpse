import { TWITCH_CHANNELS_DEFAULTS, type TwitchChannelsConfig } from '../../../shared/widgets/twitch';
import type { TwitchChannelsData } from '../../../shared/widgets/payloads';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { useState } from 'react';
import chromeStyles from '../../components/widget-chrome.module.css';
import styles from './twitch-channels.module.css';

function formatViewers(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${n}`;
}

function TwitchChannels({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as TwitchChannelsConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const streams = ((data as TwitchChannelsData | null) ?? []) as TwitchChannelsData;
  const collapseAfter = cfg['collapse-after'] ?? TWITCH_CHANNELS_DEFAULTS['collapse-after'];
  const [expanded, setExpanded] = useState(false);
  const hasCollapse = collapseAfter >= 0 && streams.length > collapseAfter;
  const visible = hasCollapse && !expanded ? streams.slice(0, collapseAfter) : streams;

  if (loading) {
    return (
      <WidgetChrome
        title={cfg.title ?? 'Twitch'}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        isLoading
        error={error}
      />
    );
  }

  return (
    <WidgetChrome
      title={cfg.title ?? 'Twitch'}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      isLoading={loading}
      error={error}
    >
      {streams.length === 0 && !loading ? <div className={styles.empty}>No channels tracked</div> : null}
      <ul className={styles.list}>
        {visible.map((s) => (
          <li key={s.login} className={`${styles.row} ${s.live ? '' : styles.offline}`}>
            {s.live && s.thumbnailUrl ? (
              <img src={s.thumbnailUrl} alt="" className={styles.thumb} loading="lazy" />
            ) : null}
            <div className={styles.body}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className={styles.name}>
                {s.live ? <span className={styles.dot} aria-label="live" /> : null}
                {s.displayName}
              </a>
              {s.live ? <div className={styles.title}>{s.title}</div> : <div className={styles.title}>Offline</div>}
              <div className={styles.meta}>
                {s.gameName ? <span>{s.gameName}</span> : null}
                {s.live ? <span>{formatViewers(s.viewerCount)} watching</span> : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {hasCollapse ? (
        expanded ? (
          <button type="button" className={`${chromeStyles.more} ${chromeStyles.moreExpanded}`} onClick={() => setExpanded(false)}>
            Show less
          </button>
        ) : (
          <button type="button" className={chromeStyles.more} onClick={() => setExpanded(true)}>
            {`Show more (${streams.length - collapseAfter})`}
          </button>
        )
      ) : null}
    </WidgetChrome>
  );
}

registerWidgetComponent('twitch-channels', TwitchChannels);

export default TwitchChannels;
