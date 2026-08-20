import { Eye } from 'lucide-react';
import type { TwitchChannelsConfig, TwitchTopGamesConfig } from '../../../shared/widgets/keyed';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import type { TwitchChannel, TwitchGame } from '../../../shared/widgets/payloads';
import styles from './twitch.module.css';

function ChannelRow({ channel }: { channel: TwitchChannel }) {
  return (
    <div className={`${styles.row} ${channel.live ? styles.live : ''}`}>
      {channel.thumbnail ? (
        <img src={channel.thumbnail} alt="" loading="lazy" className={styles.rowThumb} />
      ) : (
        <div className={styles.rowThumbPlaceholder} />
      )}
      <div className={styles.rowBody}>
        <div className={styles.nameRow}>
          <span className={styles.displayName}>{channel.displayName}</span>
          {channel.live ? (
            <span className={styles.liveBadge}>
              <Eye size={12} />
              <span>LIVE</span>
            </span>
          ) : null}
        </div>
        {channel.live ? (
          <>
            {channel.title ? <div className={styles.title}>{channel.title}</div> : null}
            <div className={styles.meta}>
              {channel.viewers > 0 ? (
                <span className={styles.viewers}>
                  <Eye size={12} />
                  {channel.viewers.toLocaleString()}
                </span>
              ) : null}
              {channel.game ? <span>{channel.game}</span> : null}
            </div>
          </>
        ) : (
          <div className={styles.offline}>Offline</div>
        )}
      </div>
    </div>
  );
}

function TwitchChannels({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as TwitchChannelsConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const channels = ((data as { channels?: TwitchChannel[] } | null)?.channels ?? []) as TwitchChannel[];
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      error={error}
      isLoading={loading}
      collapseAfter={cfg['collapse-after']}
      items={channels.map((c) => <ChannelRow key={c.login} channel={c} />)}
    />
  );
}
function GameCard({ game, rank }: { game: TwitchGame; rank: number }) {
  return (
    <div className={styles.gameCard}>
      {game.thumbnail ? (
        <img src={game.thumbnail} alt="" loading="lazy" className={styles.gameThumb} />
      ) : (
        <div className={styles.gameThumbPlaceholder} />
      )}
      <div className={styles.gameInfo}>
        <span className={styles.rank}>#{rank}</span>
        <span className={styles.gameName}>{game.name}</span>
      </div>
    </div>
  );
}
function TwitchTopGames({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as TwitchTopGamesConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const games = ((data as { games?: TwitchGame[] } | null)?.games ?? []) as TwitchGame[];
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      error={error}
      isLoading={loading}
      collapseAfter={cfg['collapse-after']}
      items={games.map((g, i) => <GameCard key={g.id} game={g} rank={i + 1} />)}
    />
  );
}

registerWidgetComponent('twitch-channels', TwitchChannels);
registerWidgetComponent('twitch-top-games', TwitchTopGames);

export { TwitchChannels, TwitchTopGames };
