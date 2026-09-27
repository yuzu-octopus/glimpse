import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from './SettingsPanel';
import { bangs } from '../../shared/widgets/bangs';
import styles from './settings-panel.module.css';

const stylesheet = readFileSync(resolve('src/client/components/settings-panel.module.css'), 'utf8');

/**
 * jsdom does not implement the <dialog> modal methods; Astryx Dialog calls
 * showModal/close in an effect when isOpen flips. Stub them on the prototype
 * (attribute-backed, matching the real reflection).
 */
function stubDialogModal() {
  const proto = HTMLDialogElement.prototype as unknown as {
    showModal?: () => void;
    close?: () => void;
    open?: boolean;
  };
  if (proto.showModal) return;
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
  Object.defineProperty(proto, 'open', {
    configurable: true,
    get(this: HTMLDialogElement) {
      return this.hasAttribute('open');
    },
    set(this: HTMLDialogElement, value: boolean) {
      if (value) this.setAttribute('open', '');
      else this.removeAttribute('open');
    },
  });
}

function stubConfigApi(overrides: Record<string, unknown> = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        ok: true,
        config: {},
        configPath: '/etc/glimpse/config.yml',
        version: '9.9.9',
        ...overrides,
      }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeAll(() => {
  stubDialogModal();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SettingsPanel section sidebar', () => {
  it('opens on About and lists exactly About and Docs', () => {
    stubConfigApi();
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    const nav = screen.getByTestId('settings-nav');
    const about = within(nav).getByText('About').closest('button');
    const docs = within(nav).getByText('Docs').closest('button');

    // Kit SideNavItem: a real button per section, current one aria-current.
    expect(about).not.toBeNull();
    expect(docs).not.toBeNull();
    expect(about).toHaveAttribute('aria-current', 'page');
    expect(docs).not.toHaveAttribute('aria-current');
    expect(document.getElementById('settings-panel-about')).not.toBeNull();
  });

  it('keeps every section reachable by keyboard — no href-less anchors', () => {
    stubConfigApi();
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    for (const label of ['About', 'Docs']) {
      const item = within(screen.getByTestId('settings-nav')).getByText(label).closest('button');
      expect(item?.tagName).toBe('BUTTON');
      expect(item).not.toBeDisabled();
    }
  });

  it('offers no theme picker — the brand theme is not a user setting', () => {
    stubConfigApi();
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    // The astryx-dracula collapse: no Appearance section, no preset cards,
    // no light/dark mode control anywhere in the dialog.
    expect(screen.queryByText('Appearance')).toBeNull();
    expect(screen.queryByTestId('preset-card')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Color mode' })).toBeNull();
    expect(screen.queryByText('Light')).toBeNull();
    expect(screen.queryByText('System')).toBeNull();
  });

  it('loads the app facts from /api/config when the dialog opens', async () => {
    const fetchMock = stubConfigApi();
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(await screen.findByText('9.9.9')).toBeInTheDocument();
    expect(screen.getByText('/etc/glimpse/config.yml')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/config',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('falls back to unknown facts when /api/config fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect((await screen.findAllByText('unknown')).length).toBeGreaterThan(0);
  });

  it('switches to the Docs pane without remounting the content box', async () => {
    stubConfigApi();
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByText('9.9.9');

    const pane = document.querySelector(`.${styles.content}`);
    expect(pane).not.toBeNull();

    fireEvent.click(within(screen.getByTestId('settings-nav')).getByText('Docs'));

    // tab switches swap only the inner section — the element carrying the
    // fixed-height rule stays mounted, so the dialog never resizes
    expect(document.querySelector(`.${styles.content}`)).toBe(pane);
    expect(document.getElementById('settings-panel-docs')).not.toBeNull();
    expect(screen.queryByText('9.9.9')).toBeNull();
    expect(screen.getByRole('link', { name: 'helium.computer/bangs' })).toHaveAttribute(
      'href',
      'https://helium.computer/bangs',
    );
  });

  it('renders the bang list as real table rows, not card-wrapped items', async () => {
    stubConfigApi();
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByText('9.9.9');
    fireEvent.click(within(screen.getByTestId('settings-nav')).getByText('Docs'));

    const table = screen.getByRole('table', { name: 'Shebang bangs' });
    expect(within(table).getByRole('columnheader', { name: 'Shortcut' })).toBeInTheDocument();
    // Every curated bang reaches the reader as a row, not a bare div.
    for (const bang of bangs.slice(0, 3)) {
      expect(within(table).getByRole('cell', { name: bang.title })).toBeInTheDocument();
    }
    expect(within(table).getAllByRole('row')).toHaveLength(bangs.length + 1);

  });
});

describe('SettingsPanel About facts', () => {
  it('keeps the version/config-path pairs as a definition list', async () => {
    stubConfigApi();
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByText('9.9.9');

    const list = document.querySelector('dl');
    expect(list).not.toBeNull();
    expect(within(list as HTMLElement).getByText('Version').tagName).toBe('DT');
    expect(within(list as HTMLElement).getByText('9.9.9').tagName).toBe('DD');
    expect(within(list as HTMLElement).getByText('Config file').tagName).toBe('DT');
  });

  // The About request is fired from a click, not from an effect, so it can
  // still be in flight when the panel goes away. The `cancelled` guard is what
  // stops the late answer being written; the signal is what stops the request.
  it('tears the in-flight About request down when the panel unmounts', async () => {
    const { promise } = Promise.withResolvers<Response>();
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => promise);
    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    const signal = fetchMock.mock.calls[0][1]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);

    unmount();
    expect(signal?.aborted).toBe(true);
  });
});

describe('SettingsPanel layout contract', () => {
  it('pins the fixed content-pane height so tab switches never resize the dialog', () => {
    expect(stylesheet).toMatch(/\.content\s*\{[^}]*height:\s*calc\(85vh - 96px\)/);
  });

  it('carries no shadow-based depth and no pills', () => {
    for (const value of stylesheet.matchAll(/box-shadow\s*:\s*([^;]+);/g)) {
      expect(value[1].trim().startsWith('none')).toBe(true);
    }
    expect(stylesheet).not.toMatch(/border-radius\s*:\s*(50%|999)/);
  });

  it('section title and docs sub-heading sit on distinct heading tiers', () => {
    stubConfigApi();
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(within(screen.getByTestId('settings-nav')).getByText('Docs'));

    expect(screen.getByRole('heading', { level: 2, name: 'Docs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Shebang' })).toBeInTheDocument();
  });
});

describe('SettingsPanel trigger and dialog', () => {
  it('the gear button opens the settings dialog and the close button closes it', () => {
    stubConfigApi();
    render(<SettingsPanel />);

    const trigger = screen.getByRole('button', { name: 'Settings' });
    expect(trigger.querySelector('svg')).not.toBeNull();
    expect(document.querySelector('dialog')?.open).toBe(false);

    fireEvent.click(trigger);
    expect(document.querySelector('dialog')?.open).toBe(true);
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.querySelector('dialog')?.open).toBe(false);
  });

  // <dialog> is portalled outside #root and Chromium's UA stylesheet paints it
  // `color: canvastext`; neither Astryx core nor the kit overrides that, so
  // every descendant without its own rule inherited pure white.
  it('seats the portalled dialog on a text token instead of the UA canvastext', () => {
    expect(stylesheet).toMatch(/\.dialog\s*\{[^}]*color:\s*var\(--color-text-[a-z-]+\)/);

    stubConfigApi();
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    const dialog = document.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.className).toContain(styles.dialog);
  });
});
