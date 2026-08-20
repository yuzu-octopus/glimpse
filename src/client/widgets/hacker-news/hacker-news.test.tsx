import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HackerNews from './index';

const posts = [
  {
    id: 1,
    title: 'HN story one',
    url: 'https://example.com/story',
    commentsUrl: 'https://news.ycombinator.com/item?id=1',
    score: 100,
    comments: 25,
    ageSeconds: 3600,
  },
  {
    id: 2,
    title: 'HN story two',
    url: '',
    commentsUrl: 'https://news.ycombinator.com/item?id=2',
    score: 4,
    comments: 0,
    ageSeconds: 60,
  },
];

describe('hacker-news widget', () => {
  it('renders posts with source domain, score, comments and relative age', () => {
    render(<HackerNews config={{ type: 'hacker-news', title: 'Hacker News' }} data={{ posts }} />);
    expect(screen.getByText('Hacker News')).toBeInTheDocument();
    expect(screen.getByText('HN story one')).toBeInTheDocument();
    expect(screen.getByText('HN story two')).toBeInTheDocument();
    // generic Feed combines meta into single line "example.com • 100 points • 25 comments • 1h"
    expect(screen.getByText(/example\.com/)).toBeInTheDocument();
    expect(screen.queryAllByText(/example\.com/)).toHaveLength(1);
    expect(screen.getByText(/100 points/)).toBeInTheDocument();
    expect(screen.getByText(/25 comments/)).toBeInTheDocument();
    expect(screen.getByText(/1h/)).toBeInTheDocument();
    expect(screen.getByText(/1m/)).toBeInTheDocument();
  });

  it('renders an empty chrome without crashing on empty data', () => {
    const { container } = render(<HackerNews config={{ type: 'hacker-news' }} data={{ posts: [] }} />);
    expect(container.querySelector('[data-testid="widget-body"]')).toBeInTheDocument();
    expect(screen.queryByText('HN story one')).toBeNull();
  });

  it('collapses posts beyond collapse-after until "Show more" is clicked', () => {
    render(
      <HackerNews config={{ type: 'hacker-news', 'collapse-after': 1 }} data={{ posts }} />,
    );
    expect(screen.getByText('HN story one')).toBeInTheDocument();
    expect(screen.queryByText('HN story two')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /show more/i }));
    expect(screen.getByText('HN story two')).toBeInTheDocument();
  });

  it('renders Hacker News as a source header when enabled and no explicit title', () => {
    render(<HackerNews config={{ type: 'hacker-news', 'source-header': true }} data={{ posts }} />);
    expect(screen.getByText('Hacker News')).toBeInTheDocument();
  });

  it('ignores source-header when an explicit title is set', () => {
    render(
      <HackerNews config={{ type: 'hacker-news', title: 'Top Stories', 'source-header': true }} data={{ posts }} />,
    );
    expect(screen.getByText('Top Stories')).toBeInTheDocument();
    expect(screen.queryByText('Hacker News')).toBeNull();
  });

  it('lets hide-header beat source-header', () => {
    render(
      <HackerNews config={{ type: 'hacker-news', 'source-header': true, 'hide-header': true }} data={{ posts }} />,
    );
    expect(screen.queryByText('Hacker News')).toBeNull();
  });
});
