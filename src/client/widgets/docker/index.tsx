import { useState } from 'react';
import { Link } from '@astryxdesign/core';
import { ChevronRight } from 'lucide-react';
import type { DockerContainersConfig } from '../../../shared/widgets/docker';
import type { DockerContainer, DockerData } from '../../../shared/widgets/payloads';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './docker.module.css';

const STATE_CLASS: Record<DockerContainer['stateIcon'], string> = {
  ok: styles.stateOk,
  warn: styles.stateWarn,
  paused: styles.statePaused,
  unknown: styles.stateUnknown,
};

function ContainerRow({ c }: { c: DockerContainer }) {
  const [open, setOpen] = useState(false);
  const hasChildren = (c.children?.length ?? 0) > 0;
  const title = (
    <span className={styles.name} data-testid="docker-name">
      {c.name}
    </span>
  );
  return (
    <div className={styles.row}>
      <img src={c.icon.url || '/dockerhub.svg'} alt="" className={styles.icon} loading="lazy" />
      <div className={styles.body}>
        <div className={styles.titleRow}>
          {c.url ? (
            <Link href={c.url} target={c.sameTab ? undefined : '_blank'} className={styles.link} hasUnderline={false}>
              {title}
            </Link>
          ) : (
            title
          )}
          <span
            className={`${styles.badge} ${STATE_CLASS[c.stateIcon]}`}
            data-testid={`docker-state-${c.stateIcon}`}
            title={`${c.state}: ${c.stateText}`}
          >
            {c.stateText || c.state || 'unknown'}
          </span>
        </div>
        <span className={styles.image}>{c.image}</span>
        {c.description ? <span className={styles.description}>{c.description}</span> : null}
        {hasChildren ? (
          <>
            <button type="button" className={styles.expand} onClick={() => setOpen(!open)} aria-expanded={open}>
              <ChevronRight size={12} className={open ? styles.chevronOpen : styles.chevron} />
              {`${c.children!.length} container${c.children!.length === 1 ? '' : 's'}`}
            </button>
            {open ? (
              <ul className={styles.children}>
                {c.children!.map((child) => (
                  <li key={child.name} className={styles.child}>
                    <span
                      className={`${styles.dot} ${STATE_CLASS[child.stateIcon]}`}
                      data-testid={`docker-state-${child.stateIcon}`}
                    />
                    <span className={styles.childName}>{child.name}</span>
                    <span className={styles.childState}>{child.stateText || child.state}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function DockerContainers({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as DockerContainersConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const containers = ((data as DockerData | null) ?? []) as DockerData;
  return (
    <WidgetChrome
      title={cfg.title ?? 'Docker'}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      error={error}
      isLoading={loading}
      collapseAfter={8}
      items={containers.map((c) => (
        <ContainerRow key={c.name} c={c} />
      ))}
    />
  );
}

registerWidgetComponent('docker-containers', DockerContainers);

export default DockerContainers;
