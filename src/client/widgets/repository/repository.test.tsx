import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Repository from './index';
import styles from './repository.module.css';

const repo = {
  name: 'glimpse',
  description: 'Self-hosted dashboard',
  stars: 1234,
  url: 'https://github.com/user/glimpse',
  pulls: [
    { number: 12, title: 'Add keyed widgets', url: 'https://github.com/user/glimpse/pull/12' },
    { number: 11, title: 'Fix theming', url: 'https://github.com/user/glimpse/pull/11' },
  ],
  issues: [{ number: 4, title: 'PWA offline fails', url: 'https://github.com/user/glimpse/issues/4' }],
};

describe('repository widget', () => {
  it('renders repo name, stars, description, PRs and issues', () => {
    render(<Repository config={{ type: 'repository', repository: 'user/glimpse' }} data={repo} />);
    expect(screen.getByText('glimpse')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('Self-hosted dashboard')).toBeInTheDocument();
    expect(screen.getByText('Pull requests')).toBeInTheDocument();
    expect(screen.getByText('Add keyed widgets')).toBeInTheDocument();
    expect(screen.getByText('#12')).toBeInTheDocument();
    expect(screen.getByText('Issues')).toBeInTheDocument();
    expect(screen.getByText('PWA offline fails')).toBeInTheDocument();
  });

  it('renders without stars or sub-lists when data is absent', () => {
    render(
      <Repository
        config={{ type: 'repository', repository: 'user/glimpse' }}
        data={{ name: 'glimpse', description: null, stars: null, url: '', pulls: [], issues: [] }}
      />,
    );
    expect(screen.getByText('glimpse')).toBeInTheDocument();
    expect(screen.getByTestId('widget-body')).toBeInTheDocument();
    expect(screen.queryByText('Pull requests')).toBeNull();
  });

  it('falls back to the configured repository name when data is missing', () => {
    render(<Repository config={{ type: 'repository', repository: 'user/other' }} data={null} isLoading={false} />);
    expect(screen.getByText('user/other')).toBeInTheDocument();
  });

  it('renders a commits sub-list with the short sha as the lead', () => {
    render(
      <Repository
        config={{ type: 'repository', repository: 'user/glimpse' }}
        data={{
          ...repo,
          commits: [
            {
              sha: 'a1b2c3d',
              message: 'Ship it',
              author: 'Robin',
              date: '2024-01-01T10:00:00Z',
              url: 'https://github.com/user/glimpse/commit/a1b2c3d',
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('Commits')).toBeInTheDocument();
    expect(screen.getByText('a1b2c3d')).toBeInTheDocument();
    expect(screen.getByText('Ship it')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ship it/ })).toHaveAttribute(
      'href',
      'https://github.com/user/glimpse/commit/a1b2c3d',
    );
    // The commit's own author and age, not just the sha and subject
    expect(screen.getByText(/Robin · \d+[smhd] ago/)).toBeInTheDocument();
  });

  it('renders a commit with no author and no date as the message alone', () => {
    render(
      <Repository
        config={{ type: 'repository', repository: 'user/glimpse' }}
        data={{
          ...repo,
          commits: [
            { sha: 'deadbee', message: 'Anonymous', author: '', date: null, url: 'https://github.com/user/glimpse/commit/deadbee' },
          ],
        }}
      />,
    );
    expect(screen.getByText('Anonymous')).toBeInTheDocument();
    // no second line: a description would have joined the message inside the
    // link's own accessible name, so the exact-name match is the assertion
    expect(screen.getByRole('link', { name: 'Anonymous' })).toBeInTheDocument();
  });

  it('shows no commits section when the payload carries none', () => {
    render(<Repository config={{ type: 'repository', repository: 'user/glimpse' }} data={repo} />);
    expect(screen.queryByText('Commits')).toBeNull();
  });

  it('surfaces a fetch error via the widget chrome', () => {
    render(
      <Repository config={{ type: 'repository', title: 'Repo', repository: 'user/other' }} data={null} error="GitHub API unavailable" />,
    );
    expect(screen.getByText('GitHub API unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('widget-error-dot')).toBeInTheDocument();
    expect(screen.queryByText('user/other')).toBeNull();
  });

  // astryx's Link is a styled text link: it nests whatever it renders in one
  // span, and that span was the row's only flex item, so the row needed
  // `.subRow > * { display: grid; … }` to constrain it. ListItem lays the
  // lead / title / second line out itself, and it is a list item, so the
  // rows need a real list around them.
  it('renders each sub-row as a list item inside the sub-list', () => {
    const { container } = render(
      <Repository config={{ type: 'repository', repository: 'user/glimpse' }} data={repo} />,
    );
    const list = container.querySelector(`.${styles.subRows}`)!;
    expect(list.tagName).toBe('UL');
    const rows = list.querySelectorAll(`.${styles.subRow}`);
    expect(rows).toHaveLength(2);
    expect(rows[0].tagName).toBe('LI');
    // the lead and the title are the item's own slots, and the real link
    // lives inside the row rather than wrapping it
    expect(rows[0].querySelector(`.${styles.subNumber}`)?.textContent).toBe('#12');
    expect(rows[0].querySelector('a')).toBe(
      screen.getByRole('link', { name: 'Add keyed widgets' }),
    );
  });

  it('needs no wrapper grid: the item carries the number and title itself', () => {
    const css = readFileSync('src/client/widgets/repository/repository.module.css', 'utf8');
    expect(css).not.toMatch(/\.subRow > \*/);
  });
});
