import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getIcon, Icon } from '@astryxdesign/core';
import { draculaIconRegistry } from 'astryx-dracula';
import './icons';

/**
 * The kit's registry is registered globally at app init. Core resolves every
 * semantic icon through getIcon(), so overriding the registry is what makes
 * chevrons/close/check render the brand set instead of core's defaults.
 */
const BRAND_KEYS = ['close', 'chevronDown', 'chevronLeft', 'chevronRight', 'check', 'arrowUp', 'arrowDown', 'search', 'calendar', 'clock'] as const;

describe('brand icon registry', () => {
  it.each(BRAND_KEYS)('resolves %s to the kit icon, not core default', (name) => {
    expect(getIcon(name)).toBe(draculaIconRegistry[name]);
  });

  it('covers the whole kit registry, not a hand-picked subset', () => {
    for (const name of Object.keys(draculaIconRegistry) as (keyof typeof draculaIconRegistry)[]) {
      expect(getIcon(name), name).toBe(draculaIconRegistry[name]);
    }
  });

  it('paints an Astryx <Icon> with the kit glyph', () => {
    const { container } = render(<Icon icon="chevronDown" size="sm" />);
    const path = container.querySelector('path');
    // core's built-in chevronDown is "M6 9l6 6 6-6"; lucide's is "m6 9 6 6 6-6"
    expect(path?.getAttribute('d')).toBe('m6 9 6 6 6-6');
  });
});
