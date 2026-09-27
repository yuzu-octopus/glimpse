import type { ReactNode } from 'react';
import { fmtNumber } from '../_helpers/fmtNumber';
import { Link } from '@astryxdesign/core';
import { CircleDot, GitCommitHorizontal, GitPullRequest, Star } from 'lucide-react';
import type { RepositoryConfig } from '../../../shared/widgets/keyed';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import type { RepoCommit, RepoPull, RepositoryData } from '../../../shared/widgets/payloads';
import styles from './repository.module.css';

/** A row is a lead, a title and a destination — glance lays pull requests,
 * issues and commits out identically, differing only in the lead (#N, sha). */
interface Row {
  lead: string;
  title: string;
  url: string;
}

const asRow = (p: RepoPull): Row => ({ lead: `#${p.number}`, title: p.title, url: p.url });
const asCommitRow = (c: RepoCommit): Row => ({ lead: c.sha, title: c.message, url: c.url });

function SubList({ icon, label, rows }: { icon: ReactNode; label: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <div className={styles.subList}>
      <div className={styles.subHeader}>
        {icon}
        <span>{label}</span>
      </div>
      {rows.map((r) => (
        <Link key={`${r.lead}::${r.url}`} href={r.url} target="_blank" className={styles.subRow} hasUnderline={false}>
          <span className={styles.subNumber}>{r.lead} </span>
          <span className={styles.subTitle}>{r.title}</span>
        </Link>
      ))}
    </div>
  );
}

function Repository({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as RepositoryConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const repo = (data ?? {}) as Partial<RepositoryData>;
  const pulls = (repo.pulls ?? []).map(asRow);
  const issues = (repo.issues ?? []).map(asRow);
  // Absent unless commits-limit was raised above glance's -1 default.
  const commits = (repo.commits ?? []).map(asCommitRow);
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      error={error}
      showErrors={cfg['show-errors']}
      isLoading={loading}
      items={[
        <div key="header" className={styles.header}>
          <Link href={repo.url ?? '#'} target="_blank" className={styles.repoName} hasUnderline={false}>
            {repo.name ?? cfg.repository}
          </Link>
          {repo.stars !== null && repo.stars !== undefined ? (
            <span className={styles.stars}>
              <Star size={13} />
              {fmtNumber(repo.stars)}
            </span>
          ) : null}
          {repo.description ? <div className={styles.desc}>{repo.description}</div> : null}
        </div>,
        <SubList key="pulls" icon={<GitPullRequest size={13} />} label="Pull requests" rows={pulls} />,
        <SubList key="commits" icon={<GitCommitHorizontal size={13} />} label="Commits" rows={commits} />,
        <SubList key="issues" icon={<CircleDot size={13} />} label="Issues" rows={issues} />,
      ]}
    />
  );
}

registerWidgetComponent('repository', Repository);

export default Repository;
