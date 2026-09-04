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
});
