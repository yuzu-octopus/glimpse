import type { ReactNode } from 'react';
import { fmtNumber } from '../_helpers/fmtNumber';
import { ListItem, Link } from '@astryxdesign/core';
import { CircleDot, GitCommitHorizontal, GitPullRequest, Star } from 'lucide-react';
import type { RepositoryConfig } from '../../../shared/widgets/keyed';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import type { RepoCommit, RepoPull, RepositoryData } from '../../../shared/widgets/payloads';
import { useAge } from '../_hooks/useAge';
import styles from './repository.module.css';

/** A row is a lead, a title and a destination — glance lays pull requests,
 * issues and commits out identically, differing only in the lead (#N, sha).
 * `author`/`date` are the second line a commit carries and the other two do
 * not. */
interface Row {
  lead: string;
  title: string;
  url: string;
  author?: string;
  date?: string | null;
}

const asRow = (p: RepoPull): Row => ({ lead: `#${p.number}`, title: p.title, url: p.url });

const asCommitRow = (c: RepoCommit): Row => ({
  lead: c.sha,
  title: c.message,
  url: c.url,
  author: c.author,
  date: c.date,
});

/** glance repository.html puts the commit's author in a `title` and the age
 * beside the message; a tooltip is unreachable on a dashboard, so both become
 * the row's description line.
 *
 * A COMPONENT, not a helper called from the row mapper: `useAge` is a hook, and
 * mapping it over a list makes the hook count track the list length. This
 * widget polls, so a new commit changes that count between renders and React
 * tears down the tree. The age comes from the shared ticker, so a widget left
 * open keeps counting. */
function CommitDescription({ author, date }: { author?: string; date?: string | null }) {
  const age = useAge(date ?? null);
  const parts = [author?.trim(), age ? `${age} ago` : null].filter(Boolean);
  return <>{parts.length > 0 ? parts.join(' · ') : null}</>;
}

function SubList({ icon, label, rows }: { icon: ReactNode; label: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <div className={styles.subList}>
      <div className={styles.subHeader}>
        {icon}
        <span>{label}</span>
      </div>
      <ul className={styles.subRows}>
        {rows.map((r) => (
          <ListItem
            key={`${r.lead}::${r.url}`}
            href={r.url}
            target="_blank"
            startContent={<span className={styles.subNumber}>{r.lead}</span>}
            label={r.title}
            description={
              r.author !== undefined || r.date !== undefined ? (
                <CommitDescription author={r.author} date={r.date} />
              ) : undefined
            }
            className={styles.subRow}
            // glance's rows are a dense 2px pad, not the item's spacing token.
            // StyleX compiles its classes with a specificity layer a CSS
            // module cannot beat, so this one value rides inline.
            style={{ padding: '2px 0' }}
          />
        ))}
      </ul>
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
