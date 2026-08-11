import { Link } from '@astryxdesign/core';
import { Container, GitBranch } from 'lucide-react';
import { releasesSchema } from '../../../shared/widgets/feeds';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { useRelativeTime } from '../useRelativeTime';
import type { Release } from '../../../server/widgets/releases';
import styles from './releases.module.css';

function SourceIcon({ source }: { source: Release['source'] }) {
  if (source === 'github') return <GitBranch size={16} className={styles.icon} />;
  if (source === 'gitlab' || source === 'codeberg') return <GitBranch size={16} className={styles.icon} />;
  return <Container size={16} className={styles.icon} />;
}

function ReleaseRow({ release, showIcon }: { release: Release; showIcon: boolean }) {
  const age = useRelativeTime(
    release.published ? (Date.now() - Date.parse(release.published)) / 1000 : 0,
  );
  return (
    <div className={styles.row}>
      <Link href={release.url} target="_blank" className={styles.title} hasUnderline={false}>
        {release.name || release.tag}
      </Link>
      <div className={styles.meta}>
        {showIcon ? <SourceIcon source={release.source} /> : null}
        {release.tag ? <span className={styles.tag}>{release.tag}</span> : null}
        {release.published ? <span>· {age}</span> : null}
      </div>
    </div>
  );
}

function Releases({ config, data }: WidgetComponentProps) {
  const cfg = releasesSchema.parse(config);
  const releases = ((data as { releases?: Release[] } | null)?.releases ?? []) as Release[];
  const showIcon = cfg['show-source-icon'] === true;
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      collapseAfter={cfg['collapse-after']}
      items={releases.map((r) => <ReleaseRow key={r.url + r.tag} release={r} showIcon={showIcon} />)}
    />
  );
}

registerWidgetComponent('releases', Releases);

export default Releases;
