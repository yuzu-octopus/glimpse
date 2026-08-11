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
    expect(screen.getByText('Dev Talk')).toBeInTheDocument();
    const img = screen.getByAltText('');
    expect(img).toHaveAttribute('src', 'https://i.ytimg.com/vi/1/hqdefault.jpg');
    // glance meta row: relative time next to the channel
    expect(screen.getAllByText(/\d+d/).length).toBeGreaterThan(0);
  });

  it('renders grid cards and survives empty data', () => {
    render(
      <Videos config={{ type: 'videos', style: 'grid-cards' }} data={{ videos: [] }} />,
    );
    expect(screen.getByTestId('widget-body')).toBeInTheDocument();
    expect(screen.queryByText('Bun 1.3 release')).toBeNull();
  });
});
