import { TWITCH_TOP_GAMES_DEFAULTS, type TwitchTopGamesConfig } from '../../../shared/widgets/twitch';
import type { TwitchTopGamesData } from '../../../shared/widgets/payloads';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { Button } from '@astryxdesign/core';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import styles from './twitch-top-games.module.css';

function TwitchTopGames({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as TwitchTopGamesConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const games = ((data as TwitchTopGamesData | null) ?? []) as TwitchTopGamesData;
  const collapseAfter = cfg['collapse-after'] ?? TWITCH_TOP_GAMES_DEFAULTS['collapse-after'];
  const [expanded, setExpanded] = useState(false);
  const hasCollapse = collapseAfter >= 0 && games.length > collapseAfter;
  const visible = hasCollapse && !expanded ? games.slice(0, collapseAfter) : games;

  if (loading) {
    return (
      <WidgetChrome
        title={cfg.title ?? 'Top Games'}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        isLoading
        error={error}
        showErrors={cfg['show-errors']}
      />
    );
  }

  return (
    <WidgetChrome
      title={cfg.title ?? 'Top Games'}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      isLoading={loading}
      error={error}
      showErrors={cfg['show-errors']}
    >
      {games.length === 0 && !loading ? <div className={styles.empty}>No top games</div> : null}
      <ol className={styles.list}>
        {visible.map((g, i) => (
          <li key={g.id || g.name} className={styles.row}>
            <span className={styles.rank}>{i + 1}</span>
            {g.boxArtUrl ? <img src={g.boxArtUrl} alt="" className={styles.art} loading="lazy" /> : null}
            <a href={g.url} target="_blank" rel="noopener noreferrer" className={styles.name}>{g.name}</a>
          </li>
        ))}
      </ol>
      {hasCollapse ? (
        <Button
          variant="ghost"
          size="sm"
          label={expanded ? 'Show less' : `Show more (${games.length - collapseAfter})`}
          endContent={<ChevronRight size={12} />}
          onClick={() => setExpanded(!expanded)}
        />
      ) : null}
    </WidgetChrome>
  );
}

registerWidgetComponent('twitch-top-games', TwitchTopGames);

export default TwitchTopGames;
