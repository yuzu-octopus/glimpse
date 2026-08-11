import { useMemo, useState, type CSSProperties } from 'react';
import {
  Dialog,
  DialogHeader,
  SegmentedControl,
  SegmentedControlItem,
  SelectableCard,
} from '@astryxdesign/core';
import { Settings } from 'lucide-react';
import { presets, type Preset } from '../../shared/theme/presets';
import { useThemeSettings } from '../theme/GlimpseThemeProvider';
import styles from './settings-panel.module.css';

// Settings dialog: glance's theme-choices language (theme-preset-preview.html)
// in a modal — gear trigger + Dialog with appearance controls and a browsable
// preset gallery. Swatches = base00 (bg), base0D (primary), base08 (negative).

export function SettingsPanel() {
  const { mode, presetId, setMode, setPresetId, configPresets } = useThemeSettings();
  const [open, setOpen] = useState(false);

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
      <Dialog isOpen={open} onOpenChange={setOpen} width={560} maxHeight="80vh">
        <DialogHeader title="Settings" onOpenChange={setOpen} />
        <div className={styles.body} data-testid="settings-panel">
          <section className={styles.section}>
            <div className={styles.groupLabel}>Appearance</div>
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
          </section>
          <div className={styles.list}>
            {renderGroup('Dark', dark)}
            {renderGroup('Light', light)}
            {renderGroup('Custom', configPresets)}
          </div>
        </div>
      </Dialog>
    </>
  );
}
