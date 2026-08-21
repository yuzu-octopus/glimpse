import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Feed from './Feed';
import styles from './Feed.module.css';

describe('Feed (generic)', () => {
  it('renders flat list with title links, meta, description, image and tags', () => {
    const items = [
      {
        title: 'First item',
        url: 'https://example.com/1',
        meta: 'example.com • 12 points • 2h',
        description: 'A short description',
        image: 'https://example.com/img.jpg',
        tags: ['News', 'Tech'],
      },
      {
        title: 'Second item',
        url: 'https://example.com/2',
        meta: 'lobste.rs • 5 points • 10m',
      },
      {
        title: 'Third with single tag',
        url: 'https://example.com/3',
        tag: 'Pinned',
      },
    ];

    const { container } = render(<Feed items={items} />);

    // titles as links
    expect(screen.getByText('First item')).toBeInTheDocument();
    expect(screen.getByText('Second item')).toBeInTheDocument();
    expect(screen.getByText('Third with single tag')).toBeInTheDocument();
    expect(screen.getByText('First item').closest('a')).toHaveAttribute('href', 'https://example.com/1');

    // meta row (subdued)
    expect(screen.getByText('example.com • 12 points • 2h')).toBeInTheDocument();
    expect(screen.getByText('lobste.rs • 5 points • 10m')).toBeInTheDocument();

    // description
    expect(screen.getByText('A short description')).toBeInTheDocument();

    // image
    const img = container.querySelector('img[src="https://example.com/img.jpg"]');
    expect(img).toBeInTheDocument();

    // tags / chips (cycled colours via nth-child)
    expect(screen.getByText('News')).toBeInTheDocument();
    expect(screen.getByText('Tech')).toBeInTheDocument();
    expect(screen.getByText('Pinned')).toBeInTheDocument();

    // rows exist and use flat list class with hover backdrop (text-highlight)
    const rows = container.querySelectorAll(`.${styles.item}`);
    expect(rows).toHaveLength(3);

    // hover is text-highlight on title — verify stylesheet rule exists rather than simulating hover
    expect(styles.title).toBeDefined();
    // CSS module will contain row/title/meta/chips etc
    expect(styles.meta).toBeDefined();
    expect(styles.chip).toBeDefined();
  });

  it('renders gracefully with minimal fields (title + url only)', () => {
    const { container } = render(
      <Feed
        items={[{ title: 'Only title', url: 'https://example.com/min' }]}
      />,
    );
    expect(screen.getByText('Only title')).toBeInTheDocument();
    expect(container.querySelectorAll(`.${styles.item}`)).toHaveLength(1);
  });

  it('renders empty without crashing', () => {
    const { container } = render(<Feed items={[]} />);
    expect(container.querySelectorAll(`.${styles.item}`)).toHaveLength(0);
  });
});
