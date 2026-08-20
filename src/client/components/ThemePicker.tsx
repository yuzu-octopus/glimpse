import { useMemo, useState, type CSSProperties } from 'react';
import { Popover, SegmentedControl, SegmentedControlItem } from '@astryxdesign/core';
import { presetById, presets, type Preset } from '../../shared/theme/presets';
import { useThemeSettings } from '../theme/GlimpseThemeProvider';
import styles from './theme-picker.module.css';

// Glance swatch language (theme-preset-preview.html): button bg = base00,
// accent squares = base0D (primary) + base08 (negative); positive defaults
// to primary, so two distinct accents render the glance default look.

export function ThemePicker() {
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

  const active = configPresets.find((p) => p.id === presetId) ?? presetById(presetId);

  const renderGroup = (label: string, group: Preset[]) =>
    group.length > 0 ? (
      <div key={label}>
        <div className={styles.groupLabel}>{label}</div>
        <div className={styles.choices}>
          {group.map((p) => {
            const current = p.id === presetId;
            return (
              <button
                key={p.id}
                type="button"
                className={`${styles.preset}${current ? ` ${styles.current}` : ''}`}
                style={{ '--color': p.dark.base00 } as CSSProperties}
                data-selected={current}
                onClick={() => setPresetId(p.id)}
              >
                <span className={styles.name} style={{ color: p.dark.base05 }}>
                  {p.name}
                </span>
                <span className={styles.swatch} style={{ '--color': p.dark.base0D } as CSSProperties} />
                <span className={styles.swatch} style={{ '--color': p.dark.base08 } as CSSProperties} />
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  return (
    <Popover
      isOpen={open}
      onOpenChange={setOpen}
      placement="end"
      label="Theme settings"
      content={
        <div className={styles.panel} data-testid="theme-panel">
          <div className={styles.modeRow}>
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
          <div className={styles.list}>
            {renderGroup('Dark', dark)}
            {renderGroup('Light', light)}
            {renderGroup('Custom', configPresets)}
          </div>
        </div>
      }
    >
      <button
        type="button"
        aria-label="Theme"
        className={[
          styles.trigger,
          active.variant === 'light' ? styles.triggerLight : '',
          open ? styles.popoverActive : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ '--color': active.dark.base00 } as CSSProperties}
      >
        <span className={styles.swatch} style={{ '--color': active.dark.base0D } as CSSProperties} />
        <span className={styles.swatch} style={{ '--color': active.dark.base08 } as CSSProperties} />
      </button>
    </Popover>
  );
}
