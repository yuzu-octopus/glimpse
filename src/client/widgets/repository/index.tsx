import type { ReactNode } from 'react';
import { Link } from '@astryxdesign/core';
import { CircleDot, GitPullRequest, Star } from 'lucide-react';
import type { RepositoryConfig } from '../../../shared/widgets/keyed';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import type { RepoPull, RepositoryData } from '../../../shared/widgets/payloads';
import styles from './repository.module.css';

function SubList({ icon, label, rows }: {
  icon: ReactNode;
  label: string;
  rows: RepoPull[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className={styles.subList}>
      <div className={styles.subHeader}>
        {icon}
        <span>{label}</span>
      </div>
      {rows.map((r) => (
        <Link key={r.number} href={r.url} target="_blank" className={styles.subRow} hasUnderline={false}>
          <span className={styles.subNumber}>#{r.number}{' '}</span>
          <span className={styles.subTitle}>{r.title}</span>
        </Link>
      ))}
    </div>
  );
}

function Repository({ config, data, error }: WidgetComponentProps) {
  const cfg = config as unknown as RepositoryConfig;
  const repo = (data ?? {}) as Partial<RepositoryData>;
  const pulls = repo.pulls ?? [];
  const issues = repo.issues ?? [];
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      error={error}
      items={[
        <div key="header" className={styles.header}>
          <Link href={repo.url ?? '#'} target="_blank" className={styles.repoName} hasUnderline={false}>
            {repo.name ?? cfg.repository}
          </Link>
          {repo.stars !== null && repo.stars !== undefined ? (
            <span className={styles.stars}>
              <Star size={13} />
              {repo.stars.toLocaleString()}
            </span>
          ) : null}
          {repo.description ? <div className={styles.desc}>{repo.description}</div> : null}
        </div>,
        <SubList key="pulls" icon={<GitPullRequest size={13} />} label="Pull requests" rows={pulls} />,
        <SubList key="issues" icon={<CircleDot size={13} />} label="Issues" rows={issues} />,
      ]}
    />
  );
}

registerWidgetComponent('repository', Repository);

export default Repository;
