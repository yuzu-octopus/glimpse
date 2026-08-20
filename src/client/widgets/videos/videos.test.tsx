import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
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
