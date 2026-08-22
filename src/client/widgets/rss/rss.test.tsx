import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Rss from './index';
import feedStyles from '../feed/feed.module.css';
import type { RssItem } from '../../../shared/widgets/payloads';

const items: RssItem[] = [
  {
    title: 'First post',
    url: 'https://example.com/1',
    published: '2024-01-01T10:00:00Z',
    source: 'Test Feed',
    thumbnail: null,
    description: 'Some description',
    categories: ['News', 'Tech'],
  },
  {
    title: 'Second post',
    url: 'https://example.com/2',
    published: null,
    source: 'Test Feed',
    thumbnail: null,
    description: null,
    categories: [],
  },
];

describe('rss widget', () => {
  it('renders a vertical list with source and relative time', () => {
    render(
      <Rss
        config={{ type: 'rss', title: 'Feed', feeds: [{ url: 'https://example.com/feed' }] }}
        data={{ items }}
      />,
    );
    expect(screen.getByText('Feed')).toBeInTheDocument();
    expect(screen.getByText('First post')).toBeInTheDocument();
    expect(screen.getAllByText(/Test Feed/)).toHaveLength(2);
    expect(screen.getByText(/· \d+d/)).toBeInTheDocument();
  });

  it('does not render descriptions or categories in a vertical list', () => {
    render(<Rss config={{ type: 'rss', feeds: [{ url: 'x' }] }} data={{ items }} />);
    expect(screen.queryByText('Some description')).toBeNull();
    expect(screen.queryByText('News')).toBeNull();
  });

  it('renders category chips and descriptions in a detailed list', () => {
    render(
      <Rss config={{ type: 'rss', style: 'detailed-list', feeds: [{ url: 'x' }] }} data={{ items }} />,
    );
    expect(screen.getByText('Some description')).toBeInTheDocument();
    expect(screen.getByText('News')).toBeInTheDocument();
    expect(screen.getByText('Tech')).toBeInTheDocument();
    // chips now rendered via generic Feed (feedStyles.chip) — rss chip styles deprecated for lists
    expect(document.querySelectorAll(`.${feedStyles.chip}`)).toHaveLength(2);
  });

  it('applies single-line titles only when configured', () => {
    const { rerender } = render(
      <Rss config={{ type: 'rss', 'single-line-titles': true, feeds: [{ url: 'x' }] }} data={{ items }} />,
    );
    const link = () => screen.getByRole('link', { name: 'First post' });
    expect(link().className).toContain(feedStyles.titleSingle);
    expect(link().className).not.toContain(feedStyles.titleClamp);

    rerender(<Rss config={{ type: 'rss', feeds: [{ url: 'x' }] }} data={{ items }} />);
    expect(link().className).toContain(feedStyles.titleClamp);
    expect(link().className).not.toContain(feedStyles.titleSingle);
  });

  it('renders the first feed title as a source header when enabled and no explicit title', () => {
    render(
      <Rss
        config={{ type: 'rss', 'source-header': true, feeds: [{ url: 'https://example.com/feed', title: 'The Feed' }] }}
        data={{ items }}
      />,
    );
    expect(screen.getByText('The Feed')).toBeInTheDocument();
  });

  it('falls back to RSS as the source header when the first feed has no title', () => {
    render(
      <Rss config={{ type: 'rss', 'source-header': true, feeds: [{ url: 'https://example.com/feed' }] }} data={{ items }} />,
    );
    expect(screen.getByText('RSS')).toBeInTheDocument();
  });

  it('ignores source-header when an explicit title is set', () => {
    render(
      <Rss
        config={{ type: 'rss', title: 'My Feed', 'source-header': true, feeds: [{ url: 'x', title: 'The Feed' }] }}
        data={{ items }}
      />,
    );
    expect(screen.getByText('My Feed')).toBeInTheDocument();
    expect(screen.queryByText('The Feed')).toBeNull();
  });

  it('lets hide-header beat source-header', () => {
    render(
      <Rss
        config={{ type: 'rss', 'source-header': true, 'hide-header': true, feeds: [{ url: 'x', title: 'The Feed' }] }}
        data={{ items }}
      />,
    );
    expect(screen.queryByText('The Feed')).toBeNull();
  });

  it('shows skeleton while loading when data is null', () => {
    render(<Rss config={{ feeds: [{ url: 'https://example.com/rss' }] } as unknown as Record<string, unknown>} data={null} />);
    expect(screen.getByTestId('widget-loading')).toBeInTheDocument();
  });
});
