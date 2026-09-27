import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Bookmarks from './index';
import { resolveIcon } from './icon';
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

  it('resolves the si: shorthand to a simple-icons URL, the way glance does', () => {
    // config.example.yml ships si:grafana; rendering it verbatim made the
    // browser ask our own SPA for /si:grafana, get HTML back, and paint a
    // broken-image glyph. The shorthand is a real glance feature, so it
    // resolves here rather than being quietly dropped from the example config.
    expect(resolveIcon('si:grafana')).toEqual({
      src: 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/grafana.svg',
      // black path on a dark-only theme
      autoInvert: true,
    });
  });

  it('takes a URL as the icon, and never mistakes its scheme for a shorthand', () => {
    expect(resolveIcon('https://example.com/icon.png')).toEqual({
      src: 'https://example.com/icon.png',
      autoInvert: false,
    });
    expect(resolveIcon('http://box.lab:8080/i.svg')).toEqual({
      src: 'http://box.lab:8080/i.svg',
      autoInvert: false,
    });
  });

  it('inverts on request, with a URL or another shorthand behind it', () => {
    expect(resolveIcon('auto-invert https://example.com/black.svg')).toEqual({
      src: 'https://example.com/black.svg',
      autoInvert: true,
    });
    expect(resolveIcon('auto-invert sh:glance-dark').src).toBe(
      'https://cdn.jsdelivr.net/gh/selfhst/icons/svg/glance-dark.svg',
    );
  });

  it('paints a resolved shorthand in the img, inverted', () => {
    const { container } = render(
      <Bookmarks
        data={null}
        config={{ type: 'bookmarks', groups: [{ links: [{ title: 'Grafana', url: 'https://grafana.lab', icon: 'si:grafana' }] }] }}
      />,
    );
    const img = container.querySelector(`.${styles.icon}`) as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/grafana.svg');
    expect(img.className).toContain(styles.iconAutoInvert);
  });

  it('drops the whole tile when the image fails to load', () => {
    const { container } = render(
      <Bookmarks
        data={null}
        config={{ type: 'bookmarks', groups: [{ links: [{ title: 'Grafana', url: 'https://grafana.lab', icon: 'https://example.com/missing.png' }] }] }}
      />,
    );
    expect(container.querySelector(`.${styles.iconContainer}`)).not.toBeNull();
    fireEvent.error(container.querySelector(`.${styles.icon}`)!);
    // the tile goes, not just the img: an empty bordered box reads as a
    // missing image just as well as the glyph did
    expect(container.querySelector(`.${styles.iconContainer}`)).toBeNull();
    expect(screen.getByRole('link', { name: 'Grafana' })).toBeInTheDocument();
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
