import { useState } from 'react';
import {
  Dialog,
  DialogHeader,
  Heading,
  IconButton,
  SideNavItem,
  Table,
  Text,
  proportional,
} from '@astryxdesign/core';
import { BookOpen, Info, Settings } from 'lucide-react';
import type { ConfigResponse } from '../../shared/api';
import { bangs } from '../../shared/widgets/bangs';
import styles from './settings-panel.module.css';
// Settings dialog: section sidebar + spacious content pane. About lists app +
// config facts from /api/config (loaded on first open, falling back to
// glance's documented defaults while loading or on failure); Docs covers
// bangs. The theme itself is not a setting — it is the astryx-dracula brand.
//
// The section switcher uses kit SideNavItems, so the active item, its
// hover/press washes and its focus ring belong to the kit; the <nav> rail
// around them stays ours because it flips to a row under the dialog. The bang
// list is a kit Table, so the dense data stays in rows. The About facts stay
// a <dl>: a definition list is the semantics, not a layout to be swapped for
// a component.

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
      <IconButton
        label="Settings"
        icon={<Settings size={18} aria-hidden="true" />}
        variant="ghost"
        className={styles.trigger}
        onClick={() => {
          setOpen(true);
          openAbout();
        }}
      />
      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        width="min(960px, calc(100vw - 32px))"
        maxHeight="85vh"
        className={styles.dialog}
      >
        <DialogHeader title="Settings" onOpenChange={setOpen} />
        <div className={styles.body} data-testid="settings-panel">
          <nav
            className={styles.nav}
            aria-label="Settings sections"
            data-testid="settings-nav"
          >
            <SideNavItem
              label="About"
              icon={<Info size={16} aria-hidden="true" />}
              isSelected={section === 'about'}
              onClick={openAbout}
            />
            <SideNavItem
              label="Docs"
              icon={<BookOpen size={16} aria-hidden="true" />}
              isSelected={section === 'docs'}
              onClick={() => setSection('docs')}
            />
          </nav>
          <div className={styles.content}>
            {section === 'about' ? (
              <section
                className={styles.section}
                id="settings-panel-about"
                aria-label="About"
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
                aria-label="Docs"
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
                <Table
                  data={bangs.map((b) => ({ ...b }))}
                  aria-label="Shebang bangs"
                  density="compact"
                  hasHover
                  columns={[
                    {
                      key: 'shortcut',
                      header: 'Shortcut',
                      width: proportional(1),
                      renderCell: (b) => <Text type="code">!{b.shortcut}</Text>,
                    },
                    { key: 'title', header: 'Title', width: proportional(2) },
                    {
                      key: 'url',
                      header: 'URL',
                      width: proportional(2),
                      renderCell: (b) => (
                        <Text type="code" wordBreak="break-all">
                          {b.url}
                        </Text>
                      ),
                    },
                  ]}
                />
              </section>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
