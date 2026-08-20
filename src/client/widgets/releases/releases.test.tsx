import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('surfaces a fetch error via the widget chrome', () => {
    render(
      <Releases config={{ type: 'releases', title: 'Releases', repositories: ['glanceapp/glance'] }} data={null} error="GitHub rate limit exceeded" />,
    );
    expect(screen.getByText('GitHub rate limit exceeded')).toBeInTheDocument();
    expect(screen.getByTestId('widget-error-dot')).toBeInTheDocument();
  });

  it('release collapsed by default, no Show more text', () => {
    render(
      <Releases
        config={{ type: 'releases', repositories: ['a/b'] }}
        data={{
          releases: [
            { name: 'v1', tag: 'v1', url: '#', published: null, source: 'github', notes: '## Notes\nfix' },
          ],
        }}
      />,
    );
    expect(screen.queryByText(/Notes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Show more/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Show release notes/)).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps expanded release open after data refresh with same url+tag (new object identity)', async () => {
    const user = userEvent.setup();
    const r1 = {
      name: 'v1',
      tag: 'v1',
      url: 'https://example.com/v1',
      published: null as string | null,
      source: 'github' as const,
      notes: '## Notes\nfix details',
    };
    const { rerender } = render(
      <Releases config={{ type: 'releases', repositories: ['a/b'] }} data={{ releases: [r1] }} />,
    );
    // collapsed initially
    expect(screen.queryByText(/fix details/)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(/Show release notes/));
    expect(screen.getByText(/fix details/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hide release notes/)).toHaveAttribute('aria-expanded', 'true');

    // Simulate LIVE poll: same release arrives as a new object (same url+tag), plus a new release on top
    const r1Refreshed = { ...r1, notes: '## Notes\nfix details' };
    const r0 = {
      name: 'v2',
      tag: 'v2',
      url: 'https://example.com/v2',
      published: null as string | null,
      source: 'github' as const,
      notes: 'new notes',
    };
    rerender(<Releases config={{ type: 'releases', repositories: ['a/b'] }} data={{ releases: [r0, r1Refreshed] }} />);
    // r1 should still be expanded even though it shifted index and got a new object identity
    expect(screen.getByText(/fix details/)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/release notes/)).toHaveLength(2);
    // expanded Set is keyed by url::tag, so order change must not collapse
    expect(screen.getAllByText(/fix details/)).toHaveLength(1);
  });
});
