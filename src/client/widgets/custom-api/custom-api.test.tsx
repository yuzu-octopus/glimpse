import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CustomApi from './index';

const items = [
  {
    title: 'Deploy #42',
    url: 'https://ci.example.com/42',
    description: 'release-candidate',
    icon: 'https://example.com/icon.png',
    subtitle: 'main',
    value: 'success',
    image: null,
    timestamp: '2m ago',
  },
  {
    title: 'No extras',
    url: null,
    description: null,
    icon: null,
    subtitle: null,
    value: null,
    image: null,
    timestamp: null,
  },
];

describe('custom-api widget', () => {
  it('renders list rows with value and timestamp', () => {
    render(<CustomApi config={{ type: 'custom-api', title: 'CI', url: 'https://api.example.com' }} data={{ items, frameless: false }} />);
    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.getByText('Deploy #42')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('success')).toBeInTheDocument();
    expect(screen.getByText('2m ago')).toBeInTheDocument();
    expect(screen.getByText('No extras')).toBeInTheDocument();
  });

  it('renders without chrome when frameless', () => {
    render(
      <CustomApi config={{ type: 'custom-api', frameless: true, url: 'https://api.example.com' }} data={{ items, frameless: true }} />,
    );
    expect(screen.getByText('Deploy #42')).toBeInTheDocument();
    expect(screen.getByTestId('custom-api-frameless')).toBeInTheDocument();
    expect(screen.queryByTestId('widget-body')).toBeNull();
  });

  it('renders an empty body without crashing on empty data', () => {
    const { container } = render(
      <CustomApi config={{ type: 'custom-api', url: 'https://api.example.com' }} data={{ items: [], frameless: false }} />,
    );
    expect(container.querySelector('[data-testid="widget-body"]')).toBeInTheDocument();
    expect(screen.queryByText('Deploy #42')).toBeNull();
  });
});
