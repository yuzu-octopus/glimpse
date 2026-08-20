import { useState } from 'react';
import { Link } from '@astryxdesign/core';
import { ChevronDown, Container, GitBranch } from 'lucide-react';
import type { ReleasesConfig } from '../../../shared/widgets/feeds';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { useRelativeTime } from '../useRelativeTime';
import type { Release } from '../../../shared/widgets/payloads';
import styles from './releases.module.css';

function SourceIcon({ source }: { source: Release['source'] }) {
  if (source === 'github') return <GitBranch size={16} className={styles.icon} />;
  if (source === 'gitlab' || source === 'codeberg') return <GitBranch size={16} className={styles.icon} />;
  return <Container size={16} className={styles.icon} />;
}

function ReleaseRow({ release, showIcon }: { release: Release; showIcon: boolean }) {
  const [open, setOpen] = useState(false);
  const age = useRelativeTime(
    release.published ? (Date.now() - Date.parse(release.published)) / 1000 : 0,
  );
  const trimmed = release.notes?.trim() ?? '';
  const hasNotes = trimmed.length > 0;

  const toggle = () => {
    if (hasNotes) setOpen((v) => !v);
  };

  return (
    <div
      className={`${styles.row} ${hasNotes ? styles.rowExpandable : ''} ${open ? styles.rowOpen : ''}`}
      onClick={hasNotes ? toggle : undefined}
      role={hasNotes ? 'button' : undefined}
      tabIndex={hasNotes ? 0 : undefined}
      aria-expanded={hasNotes ? open : undefined}
      onKeyDown={
        hasNotes
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
              }
            }
          : undefined
      }
    >
      <div className={styles.rowHeader}>
        <Link
          href={release.url}
          target="_blank"
          className={styles.title}
          hasUnderline={false}
          onClick={(e) => e.stopPropagation()}
        >
          {release.name || release.tag}
        </Link>
        {hasNotes ? (
          <button
            type="button"
            aria-label={open ? 'Hide release notes' : 'Show release notes'}
            aria-expanded={open}
            className={styles.expandBtn}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            <ChevronDown size={14} className={open ? styles.chevronOpen : styles.chevron} />
          </button>
        ) : null}
      </div>
      <div className={styles.meta}>
        {showIcon ? <SourceIcon source={release.source} /> : null}
        {release.tag ? <span className={styles.tag}>{release.tag}</span> : null}
        {release.published ? <span>· {age}</span> : null}
      </div>
      {hasNotes ? (
        <div className={`${styles.collapse} ${open ? styles.collapseOpen : ''}`}>
          <div className={styles.collapseInner}>
            {open ? <pre className={styles.notes}>{trimmed}</pre> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Releases({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as ReleasesConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const releases = ((data as { releases?: Release[] } | null)?.releases ?? []) as Release[];
  const showIcon = cfg['show-source-icon'] === true;
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      error={error}
      isLoading={loading}
      collapseAfter={cfg['collapse-after']}
      items={releases.map((r) => (
        <ReleaseRow key={r.url + r.tag} release={r} showIcon={showIcon} />
      ))}
    />
  );
}

registerWidgetComponent('releases', Releases);

export default Releases;
