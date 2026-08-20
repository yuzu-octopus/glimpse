import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Lobsters from './index';

const posts = [
  {
    id: 1,
    title: 'First post',
    url: 'https://lobste.rs/s/1',
    commentsUrl: 'https://lobste.rs/s/1/comments',
    score: 42,
    comments: 7,
    ageSeconds: 3600,
    tags: ['programming'],
  },
  {
    id: 2,
    title: 'Second post',
    url: 'https://lobste.rs/s/2',
    commentsUrl: 'https://lobste.rs/s/2/comments',
    score: 3,
    comments: 0,
    ageSeconds: 120,
    tags: ['hardware'],
  },
];

describe('lobsters widget', () => {
  it('renders posts with score, comments and relative age', () => {
    render(
      <Lobsters
        config={{ type: 'lobsters', title: 'Lobsters', 'collapse-after': 5 }}
        data={{ posts }}
      />,
    );
    expect(screen.getByText('Lobsters')).toBeInTheDocument();
    expect(screen.getByText('First post')).toBeInTheDocument();
    expect(screen.getByText('Second post')).toBeInTheDocument();
    expect(screen.getByText(/42 points/)).toBeInTheDocument();
    expect(screen.getByText(/7 comments/)).toBeInTheDocument();
    expect(screen.getByText(/1h/)).toBeInTheDocument();
  });

  it('renders an empty chrome without crashing on empty data', () => {
    const { container } = render(
      <Lobsters config={{ type: 'lobsters' }} data={{ posts: [] }} />,
    );
    expect(container.querySelector('[data-testid="widget-body"]')).toBeInTheDocument();
    expect(screen.queryByText('First post')).toBeNull();
  });

  it('collapses posts beyond collapse-after until "Show more" is clicked', () => {
    render(
      <Lobsters
        config={{ type: 'lobsters', 'collapse-after': 1 }}
        data={{ posts }}
      />,
    );
    expect(screen.getByText('First post')).toBeInTheDocument();
    expect(screen.queryByText('Second post')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /show more/i }));
    expect(screen.getByText('Second post')).toBeInTheDocument();
  });

  it('renders Lobsters as a source header when enabled and no explicit title', () => {
    render(<Lobsters config={{ type: 'lobsters', 'source-header': true }} data={{ posts }} />);
    expect(screen.getByText('Lobsters')).toBeInTheDocument();
  });

  it('ignores source-header when an explicit title is set', () => {
    render(
      <Lobsters config={{ type: 'lobsters', title: 'My Lobsters', 'source-header': true }} data={{ posts }} />,
    );
    expect(screen.getByText('My Lobsters')).toBeInTheDocument();
    expect(screen.queryByText('Lobsters')).toBeNull();
  });

  it('lets hide-header beat source-header', () => {
    render(
      <Lobsters config={{ type: 'lobsters', 'source-header': true, 'hide-header': true }} data={{ posts }} />,
    );
    expect(screen.queryByText('Lobsters')).toBeNull();
  });
});
