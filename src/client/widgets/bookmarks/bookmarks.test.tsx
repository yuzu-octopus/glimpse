import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Bookmarks from './index';
import { bookmarksSchema } from '../../../shared/widgets/bookmarks';
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

  it('gives the same bookmark the same icon accent wherever it is listed', () => {
    const link = { title: 'GitHub', url: 'https://github.com', icon: 'https://example.com/i.png' };
    const { container: first } = render(
      <Bookmarks data={null} config={{ type: 'bookmarks', groups: [{ links: [link] }] }} />,
    );
    const { container: second } = render(
      <Bookmarks
        data={null}
        config={{ type: 'bookmarks', groups: [{ links: [{ title: 'Pad', url: 'https://pad.example' }, link] }] }}
      />,
    );
    const accent = (root: HTMLElement) => root.querySelector(`.${styles.iconContainer}`)?.className;
    // the same link, second position in the second group: the accent must not
    // follow DOM position the way the old nth-child(6n+N) cycle made it
    expect(accent(second)).toBe(accent(first));
  });

  it('maps a named group colour onto an accent class, not an inline colour', () => {
    render(
      <Bookmarks
        data={null}
        config={{ type: 'bookmarks', groups: [{ title: 'Dev', color: 'cyan', links: [] }] }}
      />,
    );
    const title = screen.getByText('Dev');
    expect(title.className).toContain(styles.titleAccentCyan);
    expect(title.style.color).toBe('');
  });

  it('rejects a free-form group colour, so a title can never be painted purple', () => {
    const group = { title: 'Dev', links: [] };
    expect(bookmarksSchema.safeParse({ type: 'bookmarks', groups: [{ ...group, color: 'cyan' }] }).success).toBe(true);
    expect(bookmarksSchema.safeParse({ type: 'bookmarks', groups: [{ ...group, color: 'purple' }] }).success).toBe(false);
    expect(bookmarksSchema.safeParse({ type: 'bookmarks', groups: [{ ...group, color: '#BD93F9' }] }).success).toBe(false);
  });

  it('shows an empty message when no groups are configured', () => {
    render(<Bookmarks data={null} config={{ type: 'bookmarks' }} />);
    expect(screen.getByText('No bookmark groups configured.')).toBeInTheDocument();
  });
});
