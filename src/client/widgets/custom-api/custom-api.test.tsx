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

  it('surfaces a fetch error via the widget chrome', () => {
    render(
      <CustomApi config={{ type: 'custom-api', title: 'CI', url: 'https://api.example.com' }} data={{ items: [], frameless: false }} error="HTTP 500 for https://api.example.com" />,
    );
    expect(screen.getByText('HTTP 500 for https://api.example.com')).toBeInTheDocument();
    expect(screen.getByTestId('widget-error-dot')).toBeInTheDocument();
  });

  it('shows the error inline when frameless', () => {
    render(
      <CustomApi config={{ type: 'custom-api', frameless: true, url: 'https://api.example.com' }} data={{ items: [], frameless: true }} error="upstream down" />,
    );
    expect(screen.getByTestId('custom-api-frameless')).toBeInTheDocument();
    expect(screen.getByText('upstream down')).toBeInTheDocument();
  });

  it('stargazers shows star icon', () => {
    render(
      <CustomApi
        config={{ type: 'custom-api', url: 'https://api.github.com/repos/a/b' }}
        data={{ items: [{ title: 'Stargazers', value: '36462' }], frameless: false }}
      />,
    );
    expect(screen.getByTestId('custom-api-star')).toBeInTheDocument();
  });
  it('non-star title does not show star icon', () => {
    render(
      <CustomApi
        config={{ type: 'custom-api', url: 'https://api.github.com/repos/a/b' }}
        data={{ items: [{ title: 'Forks', value: '100' }], frameless: false }}
      />,
    );
    expect(screen.queryByTestId('custom-api-star')).not.toBeInTheDocument();
  });
});
