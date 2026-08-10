import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Rss from './index';
import styles from './rss.module.css';
import type { RssItem } from '../../../server/widgets/rss';

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
    expect(screen.getAllByText('Test Feed')).toHaveLength(2);
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
    // only the item with categories gets chips
    expect(document.querySelectorAll(`.${styles.chip}`)).toHaveLength(2);
  });

  it('applies single-line titles only when configured', () => {
    const { rerender } = render(
      <Rss config={{ type: 'rss', 'single-line-titles': true, feeds: [{ url: 'x' }] }} data={{ items }} />,
    );
    const link = () => screen.getByRole('link', { name: 'First post' });
    expect(link().className).toContain(styles.titleSingle);
    expect(link().className).not.toContain(styles.titleClamp);

    rerender(<Rss config={{ type: 'rss', feeds: [{ url: 'x' }] }} data={{ items }} />);
    expect(link().className).toContain(styles.titleClamp);
    expect(link().className).not.toContain(styles.titleSingle);
  });
});
