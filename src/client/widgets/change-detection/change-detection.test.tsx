import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ChangeDetection from './index';
import type { ChangeDetectionData } from '../../../shared/widgets/payloads';

const UNCHANGED: ChangeDetectionData = [
  { url: 'https://example.com/a', changed: false, changedAt: null },
];
const CHANGED: ChangeDetectionData = [
  {
    url: 'https://shop.test/b',
    changed: true,
    changedAt: '2026-09-04T10:00:00.000Z',
    diffSnippet: 'price: $12',
  },
];

describe('change-detection widget', () => {
  it('renders one row per watched URL', () => {
    render(
      <ChangeDetection
        config={{ type: 'change-detection' }}
        data={[...UNCHANGED, ...CHANGED]}
      />,
    );
    expect(screen.getByText('example.com')).toBeInTheDocument();
    expect(screen.getByText('shop.test')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('shows a Changed badge plus snippet only for fresh changes', () => {
    render(
      <ChangeDetection
        config={{ type: 'change-detection' }}
        data={[...UNCHANGED, ...CHANGED]}
      />,
    );
    expect(screen.getByText('Changed')).toBeInTheDocument();
    expect(screen.getByText('price: $12')).toBeInTheDocument();
    expect(screen.getByText('unchanged')).toBeInTheDocument();
  });

  it('renders nothing but chrome while loading', () => {
    render(<ChangeDetection config={{ type: 'change-detection' }} data={null} isLoading />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('surfaces fetch errors via chrome', () => {
    render(<ChangeDetection config={{ type: 'change-detection' }} data={null} error="boom" />);
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });
});
