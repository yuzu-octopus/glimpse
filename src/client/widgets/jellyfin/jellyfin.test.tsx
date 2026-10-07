import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Jellyfin from './index';
import type { MediaData } from '../../../shared/widgets/payloads';

const data: MediaData = {
  items: [
    { title: 'Dune', subtitle: 'Movie', poster: 'https://jellyfin.lab/Items/m1/Images/Primary', url: 'https://jellyfin.lab/web/index.html#!/details?id=m1', date: '2021' },
    { title: 'Pilot', subtitle: 'Severance · Season 1 E1', poster: null, url: null, date: null },
  ],
};

describe('jellyfin widget', () => {
  it('renders poster cards with subtitles', () => {
    render(<Jellyfin config={{ type: 'jellyfin' }} data={data} />);
    expect(screen.getByText('Jellyfin')).toBeInTheDocument();
    expect(screen.getByText('Dune')).toBeInTheDocument();
    expect(screen.getByText(/Movie/)).toBeInTheDocument();
    expect(screen.getByText('Severance · Season 1 E1')).toBeInTheDocument();
  });

  it('shows a placeholder when empty', () => {
    render(<Jellyfin config={{ type: 'jellyfin' }} data={{ items: [] }} />);
    expect(screen.getByText(/No recently added media/)).toBeInTheDocument();
  });

  it('shows loading skeleton while data is null', () => {
    render(<Jellyfin config={{ type: 'jellyfin' }} data={null} />);
    expect(screen.getByTestId('widget-loading')).toBeInTheDocument();
  });

  it('surfaces fetch errors via chrome', () => {
    render(<Jellyfin config={{ type: 'jellyfin' }} data={null} error="jellyfin: missing api-key" />);
    expect(screen.getByText('jellyfin: missing api-key')).toBeInTheDocument();
    expect(screen.getByTestId('widget-error-dot')).toBeInTheDocument();
  });

  it('renders a placeholder div when poster is null', () => {
    render(<Jellyfin config={{ type: 'jellyfin' }} data={data} />);
    const cards = screen.getAllByTestId('media-card');
    const placeholder = cards[1].querySelector('[class*="posterPlaceholder"]');
    expect(placeholder).toBeInTheDocument();
    expect(cards[1].querySelector('img')).toBeNull();
  });

  it('renders a non-link card when url is null', () => {
    render(<Jellyfin config={{ type: 'jellyfin' }} data={data} />);
    const cards = screen.getAllByTestId('media-card');
    expect(cards[1].tagName).toBe('DIV');
    expect(cards[1].querySelector('a')).toBeNull();
  });

  it('renders meta line with subtitle and date', () => {
    render(<Jellyfin config={{ type: 'jellyfin' }} data={data} />);
    const cards = screen.getAllByTestId('media-card');
    const meta = cards[0].querySelector('[class*="meta"]');
    expect(meta).toBeInTheDocument();
    // subtitle 'Movie' + date '2021' → ageOf('2021') returns 'today' or 'Xd ago'
    expect(meta!.textContent).toMatch(/Movie/);
    expect(meta!.textContent).toMatch(/\d+d ago|today|yesterday/);
  });

  it('renders no meta line when both subtitle and date are null', () => {
    // NOTE: the shared fixture's second item has a subtitle, so it renders a
    // meta line — use an item with both fields null to pin the suppression.
    const bare: MediaData = {
      items: [{ title: 'Pilot', subtitle: null, poster: null, url: null, date: null }],
    };
    render(<Jellyfin config={{ type: 'jellyfin' }} data={bare} />);
    const cards = screen.getAllByTestId('media-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].querySelector('[class*="meta"]')).toBeNull();
  });
});
