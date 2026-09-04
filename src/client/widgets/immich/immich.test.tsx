import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Immich from './index';
import type { MediaData } from '../../../shared/widgets/payloads';

const data: MediaData = {
  items: [
    { title: 'IMG_001.jpg', subtitle: null, poster: 'https://immich.lab/api/assets/a1/thumbnail', url: 'https://immich.lab/photos/a1', date: '2024-05-01T10:00:00' },
    { title: 'IMG_002.jpg', subtitle: null, poster: null, url: null, date: null },
  ],
};

describe('immich widget', () => {
  it('renders poster cards with titles', () => {
    const { container } = render(<Immich config={{ type: 'immich' }} data={data} />);
    expect(screen.getByText('Immich')).toBeInTheDocument();
    expect(screen.getByText('IMG_001.jpg')).toBeInTheDocument();
    expect(screen.getAllByTestId('media-card')).toHaveLength(2);
    // decorative poster (alt="") is presentational — query the DOM directly
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://immich.lab/api/assets/a1/thumbnail');
  });

  it('links cards to the photo page', () => {
    render(<Immich config={{ type: 'immich' }} data={data} />);
    expect(screen.getByRole('link', { name: /IMG_001/ })).toHaveAttribute('href', 'https://immich.lab/photos/a1');
  });

  it('shows a placeholder when empty', () => {
    render(<Immich config={{ type: 'immich' }} data={{ items: [] }} />);
    expect(screen.getByText(/No recent photos/)).toBeInTheDocument();
  });

  it('shows loading skeleton while data is null', () => {
    render(<Immich config={{ type: 'immich' }} data={null} />);
    expect(screen.getByTestId('widget-loading')).toBeInTheDocument();
  });

  it('surfaces fetch errors via chrome', () => {
    render(<Immich config={{ type: 'immich' }} data={null} error="immich: missing api-key" />);
    expect(screen.getByText('immich: missing api-key')).toBeInTheDocument();
    expect(screen.getByTestId('widget-error-dot')).toBeInTheDocument();
  });
});
