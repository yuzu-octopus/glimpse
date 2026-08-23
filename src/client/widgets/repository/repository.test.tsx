import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Repository from './index';

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

  it('surfaces a fetch error via the widget chrome', () => {
    render(
      <Repository config={{ type: 'repository', title: 'Repo', repository: 'user/other' }} data={null} error="GitHub API unavailable" />,
    );
    expect(screen.getByText('GitHub API unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('widget-error-dot')).toBeInTheDocument();
    expect(screen.queryByText('user/other')).toBeNull();
  });
});
