import { useMemo, useState, type CSSProperties } from 'react';
import { Dialog, DialogHeader, SelectableCard } from '@astryxdesign/core';
import { BookOpen, Info, Palette, Settings } from 'lucide-react';
import { presets, type Preset } from '../../shared/theme/presets';
import type { ConfigResponse } from '../../shared/api';
import { useThemeSettings } from '../theme/GlimpseThemeProvider';
import { bangs } from '../../shared/widgets/bangs';
import styles from './settings-panel.module.css';
// Settings dialog: section sidebar + spacious content pane. Appearance holds
// the mode control and the glance theme gallery (swatches = base00 bg,
// base0D primary, base08 negative); About lists app + config facts from
// /api/config (loaded on first open, fallbacks to glance's documented
// defaults while loading or on failure).

type SettingsSection = 'appearance' | 'about' | 'docs';

interface AboutInfo {
  version: string;
  configPath: string;
}

export function SettingsPanel() {
  const { presetId, setPresetId, configPresets } = useThemeSettings();
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SettingsSection>('appearance');
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

  const { dark, light } = useMemo(() => {
    // config presets win over same-id library presets (glance's
    // default-dark/default-light override semantics)
    const staticPresets = presets.filter((p) => !configPresets.some((c) => c.id === p.id));
    return {
      dark: staticPresets.filter((p) => p.variant === 'dark'),
      light: staticPresets.filter((p) => p.variant === 'light'),
    };
  }, [configPresets]);

  const renderGroup = (label: string, group: Preset[]) =>
    group.length > 0 ? (
      <div key={label} className={styles.group}>
        <div className={styles.groupLabel}>{label}</div>
        <div className={styles.grid}>
          {group.map((p) => {
            const current = p.id === presetId;
            // swatches show the preset's authored side: light palettes for
            // light-variant presets, dark palettes otherwise
            const palette = p.variant === 'light' && p.light ? p.light : p.dark;
            return (
              <SelectableCard
                key={p.id}
                label={p.name}
                isSelected={current}
                onChange={(selected) => {
                  if (selected) setPresetId(p.id);
                }}
                className={styles.card}
                style={
                  current
                    ? ({ '--_card-ring': 'inset 0 0 0 2px var(--color-primary)' } as CSSProperties)
                    : undefined
                }
                variant="transparent"
                padding={1.5}
                data-testid="preset-card"
                data-preset-id={p.id}
                data-selected={current}
              >
                <span className={styles.swatch} style={{ backgroundColor: palette.base00 }} />
                <span className={styles.swatch} style={{ backgroundColor: palette.base0D }} />
                <span className={styles.swatch} style={{ backgroundColor: palette.base08 }} />
                <span className={styles.name}>{p.name}</span>
                <span className={styles.tag}>{p.variant}</span>
              </SelectableCard>
            );
          })}
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        type="button"
        aria-label="Settings"
        className={styles.trigger}
        onClick={() => setOpen(true)}
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
              id="settings-tab-appearance"
              role="tab"
              aria-selected={section === 'appearance'}
              aria-controls="settings-panel-appearance"
              className={
                section === 'appearance'
                  ? `${styles.navItem} ${styles.navItemActive}`
                  : styles.navItem
              }
              onClick={() => setSection('appearance')}
            >
              <Palette size={16} aria-hidden="true" />
              Appearance
            </button>
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
            {section === 'appearance' ? (
              <section
                className={styles.section}
                id="settings-panel-appearance"
                role="tabpanel"
                aria-labelledby="settings-tab-appearance"
              >
                <h2 className={styles.sectionTitle}>Appearance</h2>
                <div className={styles.gallery}>
                  {renderGroup('Dark', dark)}
                  {renderGroup('Light', light)}
                  {renderGroup('Custom', configPresets)}
                </div>
              </section>
            ) : section === 'about' ? (
              <section
                className={styles.section}
                id="settings-panel-about"
                role="tabpanel"
                aria-labelledby="settings-tab-about"
              >
                <h2 className={styles.sectionTitle}>About</h2>
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
                <h2 className={styles.sectionTitle}>Docs</h2>
                <h3 className={styles.docsHeading}>Shebang</h3>
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
