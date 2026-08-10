import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Releases from './index';

const releases = [
  {
    name: 'v0.7.0',
    tag: 'v0.7.0',
    url: 'https://github.com/glanceapp/glance/releases/tag/v0.7.0',
    published: '2024-06-01T00:00:00Z',
    source: 'github' as const,
  },
  {
    name: 'stable-alpine',
    tag: 'stable-alpine',
    url: 'https://hub.docker.com/r/library/nginx/tags',
    published: null,
    source: 'docker-hub' as const,
  },
];

describe('releases widget', () => {
  it('renders each release as a link with its tag and relative time', () => {
    render(<Releases config={{ type: 'releases', repositories: ['glanceapp/glance'] }} data={{ releases }} />);
    const link = screen.getByRole('link', { name: 'v0.7.0' });
    expect(link).toHaveAttribute('href', 'https://github.com/glanceapp/glance/releases/tag/v0.7.0');
    expect(link).toHaveAttribute('target', '_blank');
    // tag appears both as the row title and in the tag pill
    expect(screen.getAllByText('stable-alpine')).toHaveLength(2);
    // relative time for the dated release
    expect(screen.getByText(/\d+d/)).toBeInTheDocument();
  });

  it('shows a source icon per release only when show-source-icon is set', () => {
    const { container, rerender } = render(
      <Releases config={{ type: 'releases', repositories: ['glanceapp/glance'] }} data={{ releases }} />,
    );
    expect(container.querySelectorAll('svg')).toHaveLength(0);
    rerender(
      <Releases
        config={{ type: 'releases', repositories: ['glanceapp/glance'], 'show-source-icon': true }}
        data={{ releases }}
      />,
    );
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });

  it('renders an empty widget body when no release data arrives', () => {
    render(<Releases config={{ type: 'releases', repositories: ['glanceapp/glance'] }} data={null} />);
    expect(screen.getByTestId('widget-body')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
