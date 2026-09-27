import { useState } from 'react';
import { Dialog, DialogHeader, Heading } from '@astryxdesign/core';
import { BookOpen, Info, Settings } from 'lucide-react';
import type { ConfigResponse } from '../../shared/api';
import { bangs } from '../../shared/widgets/bangs';
import styles from './settings-panel.module.css';
// Settings dialog: section sidebar + spacious content pane. About lists app +
// config facts from /api/config (loaded on first open, falling back to
// glance's documented defaults while loading or on failure); Docs covers
// bangs. The theme itself is not a setting — it is the astryx-dracula brand.

type SettingsSection = 'about' | 'docs';

interface AboutInfo {
  version: string;
  configPath: string;
}

export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SettingsSection>('about');
  const [about, setAbout] = useState<AboutInfo | null>(null);

  const openAbout = () => {
    setSection('about');
    if (about) return;
    fetch('/api/config')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ConfigResponse>;
      })
      .then((data) =>
        setAbout({
          version: data.version ?? 'unknown',
          configPath: data.configPath ?? 'config.yml',
        }),
      )
      .catch(() => setAbout({ version: 'unknown', configPath: 'config.yml' }));
  };

  return (
    <>
      <button
        type="button"
        aria-label="Settings"
        className={styles.trigger}
        onClick={() => {
          setOpen(true);
          openAbout();
        }}
      >
        <Settings size={18} aria-hidden="true" />
      </button>
      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        width="min(960px, calc(100vw - 32px))"
        maxHeight="85vh"
      >
        <DialogHeader title="Settings" onOpenChange={setOpen} />
        <div className={styles.body} data-testid="settings-panel">
          <nav
            className={styles.nav}
            aria-label="Settings sections"
            data-testid="settings-nav"
            role="tablist"
          >
            <button
              type="button"
              id="settings-tab-about"
              role="tab"
              aria-selected={section === 'about'}
              aria-controls="settings-panel-about"
              className={section === 'about' ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
              onClick={openAbout}
            >
              <Info size={16} aria-hidden="true" />
              About
            </button>
            <button
              type="button"
              id="settings-tab-docs"
              role="tab"
              aria-selected={section === 'docs'}
              aria-controls="settings-panel-docs"
              className={section === 'docs' ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
              onClick={() => setSection('docs')}
            >
              <BookOpen size={16} aria-hidden="true" />
              Docs
            </button>
          </nav>
          <div className={styles.content}>
            {section === 'about' ? (
              <section
                className={styles.section}
                id="settings-panel-about"
                role="tabpanel"
                aria-labelledby="settings-tab-about"
              >
                <Heading level={2} className={styles.sectionTitle}>
                  About
                </Heading>
                <p className={styles.aboutBlurb}>Glimpse — a glance-style dashboard for your homelab.</p>
                <dl className={styles.aboutList}>
                  <div className={styles.aboutRow}>
                    <dt>Version</dt>
                    <dd>{about?.version ?? 'unknown'}</dd>
                  </div>
                  <div className={styles.aboutRow}>
                    <dt>Config file</dt>
                    <dd>
                      <code className={styles.code}>{about?.configPath ?? 'config.yml'}</code>
                    </dd>
                  </div>
                </dl>
              </section>
            ) : (
              <section
                className={styles.section}
                id="settings-panel-docs"
                role="tabpanel"
                aria-labelledby="settings-tab-docs"
              >
                <Heading level={2} className={styles.sectionTitle}>
                  Docs
                </Heading>
                <Heading level={3} className={styles.docsHeading}>
                  Shebang
                </Heading>
                <p className={styles.aboutBlurb}>
                  Bangs are shortcuts that route a query directly to a site. Prefix the search with{' '}
                  <code className={styles.code}>!gh</code> or <code className={styles.code}>gh</code>{' '}
                  followed by a space — e.g. <code className={styles.code}>gh glimpse dashboard</code> opens
                  GitHub search. Source: <a href="https://helium.computer/bangs" target="_blank" rel="noopener noreferrer" className={styles.docsLink}>helium.computer/bangs</a> ({bangs.length} curated from 13k+).
                </p>
                <p className={styles.aboutBlurb}>
                  Config override: set <code className={styles.code}>bangs</code> in the{' '}
                  <code className={styles.code}>search</code> widget to replace this list; fallback is the curated helium set below.
                </p>
                <table className={styles.bangTable} aria-label="Shebang bangs">
                  <thead>
                    <tr>
                      <th>Shortcut</th>
                      <th>Title</th>
                      <th>URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bangs.map((b) => (
                      <tr key={b.shortcut}>
                        <td>
                          <code className={styles.code}>!{b.shortcut}</code>
                        </td>
                        <td>{b.title}</td>
                        <td>
                          <code className={styles.code} title={b.url}>{b.url}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
