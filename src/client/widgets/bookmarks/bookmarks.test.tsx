import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Bookmarks from './index';
import styles from './bookmarks.module.css';

describe('bookmarks widget', () => {
  it('renders group titles and link cards', () => {
    render(
      <Bookmarks
        data={null}
        config={{
          type: 'bookmarks',
          groups: [{ title: 'Dev', links: [{ title: 'GitHub', url: 'https://github.com' }] }],
        }}
      />,
    );
    expect(screen.getByText('Dev')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GitHub' }).className).toContain(styles.linkCard);
  });

  it('renders icons and descriptions when present', () => {
    const { container } = render(
      <Bookmarks
        data={null}
        config={{
          type: 'bookmarks',
          groups: [
            {
              links: [
                {
                  title: 'Docs',
                  url: 'https://docs.example.com',
                  icon: 'https://example.com/icon.png',
                  description: 'API reference',
                },
              ],
            },
          ],
        }}
      />,
    );
    expect(container.querySelector(`.${styles.icon}`)).not.toBeNull();
    expect(screen.getByText('API reference')).toBeInTheDocument();
  });

  it('shows an empty message when no groups are configured', () => {
    render(<Bookmarks data={null} config={{ type: 'bookmarks' }} />);
    expect(screen.getByText('No bookmark groups configured.')).toBeInTheDocument();
  });
});
