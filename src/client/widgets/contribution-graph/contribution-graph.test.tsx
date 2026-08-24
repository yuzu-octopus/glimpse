import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ContributionGraph from './index';

const DAYS = [
  { date: '2024-01-01', count: 0, level: 0 as const },
  { date: '2024-01-02', count: 3, level: 1 as const },
  { date: '2024-01-03', count: 8, level: 2 as const },
  { date: '2024-02-01', count: 15, level: 4 as const },
];

describe('contribution-graph widget', () => {
  it('renders one cell per day with a tooltip', () => {
    render(<ContributionGraph config={{ type: 'contribution-graph', username: 'octocat' }} data={{ username: 'octocat', days: DAYS }} />);
    expect(screen.getByTestId('contribution-grid').children).toHaveLength(DAYS.length);
    expect(screen.getByTitle('3 contributions on 2024-01-02')).toBeInTheDocument();
    expect(screen.getByTitle('0 contributions on 2024-01-01')).toBeInTheDocument();
  });

  it('shows total contributions and level ramp attributes', () => {
    render(<ContributionGraph config={{ type: 'contribution-graph', username: 'octocat' }} data={{ username: 'octocat', days: DAYS }} />);
    expect(screen.getByText('26 contributions')).toBeInTheDocument();
    expect(screen.getByTestId('cell-2024-01-03')).toHaveAttribute('data-level', '2');
    expect(screen.getByTestId('cell-2024-02-01')).toHaveAttribute('data-level', '4');
  });

  it('renders month labels when a week column starts a new month', () => {
    const weeks = [
      ...Array.from({ length: 7 }, (_, i) => ({ date: `2024-01-${String(8 + i).padStart(2, '0')}`, count: 0, level: 0 as const })),
      ...Array.from({ length: 7 }, (_, i) => ({ date: `2024-02-0${i + 1}`, count: 0, level: 0 as const })),
    ];
    render(<ContributionGraph config={{ type: 'contribution-graph', username: 'octocat' }} data={{ username: 'octocat', days: weeks }} />);
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Feb')).toBeInTheDocument();
  });

  it('renders nothing but chrome while loading', () => {
    render(<ContributionGraph config={{ type: 'contribution-graph', username: 'octocat' }} data={null} isLoading />);
    expect(screen.queryByTestId('contribution-grid')).toBeNull();
  });

  it('surfaces fetch errors via chrome', () => {
    render(<ContributionGraph config={{ type: 'contribution-graph', username: 'octocat' }} data={null} error="HTTP 404 for https://github.com/octocat" />);
    expect(screen.getByText(/HTTP 404/)).toBeInTheDocument();
    expect(screen.queryByTestId('contribution-grid')).toBeNull();
  });
});
