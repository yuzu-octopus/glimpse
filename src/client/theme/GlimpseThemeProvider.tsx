import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Theme } from '@astryxdesign/core/theme';
import { LinkProvider } from '@astryxdesign/core/Link';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

/**
 * Placeholder theme wiring for the scaffold commit. Step 5 replaces
 * neutralTheme with the base16-sourced preset pipeline (GlimpseThemeProvider
 * then owns mode + preset state from localStorage).
 */
export function GlimpseThemeProvider({ children }: { children: ReactNode }) {
  return (
    <Theme theme={neutralTheme} mode="system">
      <LinkProvider component={Link}>{children}</LinkProvider>
    </Theme>
  );
}
