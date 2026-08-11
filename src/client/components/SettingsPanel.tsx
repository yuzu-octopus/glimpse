import { useMemo, useState, type CSSProperties } from 'react';
import {
  Dialog,
  DialogHeader,
  Divider,
  SegmentedControl,
  SegmentedControlItem,
  SelectableCard,
} from '@astryxdesign/core';
import { Info, Palette, Settings } from 'lucide-react';
import { presets, type Preset } from '../../shared/theme/presets';
import type { ConfigResponse } from '../../shared/api';
import { useThemeSettings } from '../theme/GlimpseThemeProvider';
import styles from './settings-panel.module.css';

// Settings dialog: section sidebar + spacious content pane. Appearance holds
// the mode control and the glance theme gallery (swatches = base00 bg,
// base0D primary, base08 negative); About lists app + config facts from
// /api/config (loaded on first open, fallbacks to glance's documented
// defaults while loading or on failure).

type SettingsSection = 'appearance' | 'about';

interface AboutInfo {
  version: string;
  configPath: string;
}

export function SettingsPanel() {
  const { mode, presetId, setMode, setPresetId, configPresets } = useThemeSettings();
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
          </nav>
          <div className={styles.content}>
            {section === 'appearance' ? (
              <section
                className={styles.section}
                id="settings-panel-appearance"
                role="tabpanel"
                aria-labelledby="settings-tab-appearance"
              >
                <h2 className={styles.sectionTitle}>
                  Appearance
                </h2>
                <div className={styles.field}>
                  <span className={styles.groupLabel}>Color mode</span>
                  <SegmentedControl
                    value={mode}
                    onChange={(v) => setMode(v as 'system' | 'light' | 'dark')}
                    label="Color mode"
                    size="sm"
                  >
                    <SegmentedControlItem value="system" label="System" />
                    <SegmentedControlItem value="light" label="Light" />
                    <SegmentedControlItem value="dark" label="Dark" />
                  </SegmentedControl>
                </div>
                <Divider />
                <div className={styles.gallery}>
                  {renderGroup('Dark', dark)}
                  {renderGroup('Light', light)}
                  {renderGroup('Custom', configPresets)}
                </div>
              </section>
            ) : (
              <section
                className={styles.section}
                id="settings-panel-about"
                role="tabpanel"
                aria-labelledby="settings-tab-about"
              >
                <h2 className={styles.sectionTitle}>
                  About
                </h2>
                <p className={styles.aboutBlurb}>
                  Glimpse — a glance-style dashboard for your homelab.
                </p>
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
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
