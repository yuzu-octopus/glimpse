import { useMemo, useState } from 'react';
import { IconButton, Popover, SegmentedControl, SegmentedControlItem } from '@astryxdesign/core';
import { Palette } from 'lucide-react';
import { presets, type Preset } from '../../shared/theme/presets';
import { useThemeSettings } from '../theme/GlimpseThemeProvider';
import styles from './theme-picker.module.css';

function swatchOf(preset: Preset): string {
  // sample the accent + background of the active side for the swatch
  const side = preset.variant === 'light' && preset.light ? preset.light : preset.dark;
  return `${side.base0D} ${side.base00}`;
}

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

  const renderGroup = (label: string, group: Preset[]) =>
    group.length > 0 ? (
      <div key={label}>
        <div className={styles.groupLabel}>{label}</div>
        {group.map((p) => (
          <button
            key={p.id}
            type="button"
            className={styles.row}
            data-selected={p.id === presetId}
            onClick={() => setPresetId(p.id)}
          >
            <span>{p.name}</span>
            <span className={styles.swatch} style={{ background: `linear-gradient(135deg, ${swatchOf(p).split(' ')[0]}, ${swatchOf(p).split(' ')[1]})` }} />
          </button>
        ))}
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
      <IconButton
        icon={<Palette size={16} />}
        label="Theme"
        variant="ghost"
        size="sm"
        aria-haspopup="dialog"
      />
    </Popover>
  );
}
