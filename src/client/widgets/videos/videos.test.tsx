import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import styles from './videos.module.css';
import { describe, expect, it } from 'vitest';
import Videos from './index';

const videos = [
  {
    title: 'Bun 1.3 release',
    url: 'https://youtube.com/watch?v=1',
    channel: 'Bun',
    published: '2025-01-01T00:00:00Z',
    thumbnail: 'https://i.ytimg.com/vi/1/hqdefault.jpg',
  },
  {
    title: 'TypeScript 7 deep dive',
    url: 'https://youtube.com/watch?v=2',
    channel: 'Dev Talk',
    published: '2025-01-02T00:00:00Z',
    thumbnail: null,
  },
];

describe('videos widget', () => {
  it('renders horizontal cards by default', () => {
    render(<Videos config={{ type: 'videos' }} data={{ videos }} />);
    expect(screen.getByText('Bun 1.3 release')).toBeInTheDocument();
    expect(screen.getByText('TypeScript 7 deep dive')).toBeInTheDocument();
    expect(screen.getByText('Bun')).toBeInTheDocument();
  });

  it('renders a vertical list with thumbnails', () => {
    render(<Videos config={{ type: 'videos', style: 'vertical-list' }} data={{ videos }} />);
    expect(screen.getByText('Bun 1.3 release')).toBeInTheDocument();
    expect(screen.getByText(/Dev Talk/)).toBeInTheDocument();
    const img = screen.getByAltText('');
    expect(img).toHaveAttribute('src', 'https://i.ytimg.com/vi/1/hqdefault.jpg');
    // glance meta row: relative time next to the channel (combined "596d • Bun")
    expect(screen.getAllByText(/\d+d/).length).toBeGreaterThan(0);
  });

  it('renders grid cards and survives empty data', () => {
    render(
      <Videos config={{ type: 'videos', style: 'grid-cards' }} data={{ videos: [] }} />,
    );
    expect(screen.getByTestId('widget-body')).toBeInTheDocument();
    expect(screen.queryByText('Bun 1.3 release')).toBeNull();
  });

  it('videos empty shows placeholder No videos', () => {
    render(<Videos config={{ type: 'videos', channels: ['UCx'] }} data={{ videos: [] }} />);
    expect(screen.getByText(/No videos/)).toBeInTheDocument();
  });

  // YouTube hands out dead hqdefault.jpg paths often enough that 4 of 10
  // thumbnails 404'd, each leaving a bare grey 16:9 box. The failed load must
  // cost the picture, never the card.
  it('falls back to the placeholder when a thumbnail fails to load', () => {
    const { container } = render(
      <Videos config={{ type: 'videos', style: 'grid-cards' }} data={{ videos }} />,
    );
    const img = container.querySelector<HTMLImageElement>(
      'img[src="https://i.ytimg.com/vi/1/hqdefault.jpg"]',
    );
    expect(img).not.toBeNull();
    fireEvent.error(img!);

    expect(
      container.querySelector('img[src="https://i.ytimg.com/vi/1/hqdefault.jpg"]'),
    ).toBeNull();
    expect(container.querySelector(`.${styles.cardThumbPlaceholder}`)).toBeInTheDocument();
    // the card itself is untouched: title and channel still read
    expect(screen.getByText('Bun 1.3 release')).toBeInTheDocument();
    expect(screen.getByText('Bun')).toBeInTheDocument();
  });

  // A 220px auto-fill track only fits two columns above ~2*220 + gap, so a
  // narrower widget got one track and stretched every card to the full body:
  // eight of them ran 2926px down the Dev page at a 1440px viewport. The
  // threshold has to be the widget's own width, not the viewport's.
  it('goes compact under a narrow widget instead of one huge card per row', () => {
    const css = readFileSync('src/client/widgets/videos/videos.module.css', 'utf8');
    expect(css).toMatch(/\.gridWrap\s*\{[^}]*container-type:\s*inline-size/);
    // 112px thumb track beside a flexible text column; `auto-fill` already
    // yields a single track this narrow, so nothing overrides it.
    expect(css).toMatch(
      /@container[\s\S]*?grid-template-columns:\s*112px minmax\(0,\s*1fr\)/,
    );
    // astryx's Link wraps the card contents in a text span, so the two-column
    // layout belongs on that wrapper — a grid on the anchor has no items to
    // place and collapses the whole card into the first column.
    expect(css).toMatch(/@container[\s\S]*?\.gridWrap \.card > \*\s*\{[^}]*grid-template-areas/);
  });

  it('surfaces a fetch error via the widget chrome', () => {
    render(
      <Videos config={{ type: 'videos', title: 'Videos' }} data={null} error="HTTP 403 for feed" />,
    );
    expect(screen.getByText('HTTP 403 for feed')).toBeInTheDocument();
    expect(screen.getByTestId('widget-error-dot')).toBeInTheDocument();
    expect(screen.queryByText('Bun 1.3 release')).toBeNull();
  });

  it('grid wraps, horizontal scrolls (css distinct)', () => {
    const css = readFileSync('src/client/widgets/videos/videos.module.css', 'utf8');
    expect(css).toMatch(/\.gridWrap[\s\S]*?grid-template-columns:\s*repeat\(auto-fill/);
    expect(css).toMatch(/\.cards[\s\S]*?overflow-x:\s*auto/);
    // grid must wrap at 220px per spec (horizontal is 180px single row)
    expect(css).toMatch(/minmax\(220px/);
  });
});
