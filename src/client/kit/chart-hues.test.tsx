import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHART_HUES } from './chart-hues';
import Markets from '../widgets/markets/index';
import { DnsStatsWidget } from '../widgets/dns/index';
import { Timer } from '../widgets/timer/index';

const here = dirname(fileURLToPath(import.meta.url));
const widgets = join(here, '..', 'widgets');
const chartCss = (name: string) => readFileSync(join(widgets, name, `${name}.module.css`), 'utf8');

const HUE_VARS = ['--bar-hue', '--spark-hue', '--ring-hue'];

/**
 * Purple means tappable, so it must never encode data. Every chart ink on the
 * markets/dns/timer surfaces has to resolve to a CHART_HUES entry (or a status
 * token for the signed sparkline), never a hand-rolled hex.
 */
describe('chart ink is the kit CHART_HUES', () => {
  it('exposes token refs only, and never purple', () => {
    for (const [name, value] of Object.entries(CHART_HUES)) {
      expect(value, name).toMatch(/^var\(--[a-z0-9-]+\)$/);
      expect(value, name).not.toMatch(/purple|#/);
    }
  });

  // The exact key set is upstream's to change — 0.3.0 added `red` — so pin the
  // rule that matters instead: purple means tappable, so it can never be a key.
  it('offers no purple category under any name', () => {
    expect(Object.keys(CHART_HUES).join(' ')).not.toMatch(/purple/);
  });

  it('resolves every rendered chart hue to a CHART_HUES value', () => {
    const { container } = render(
      <>
        <Markets
          config={{ type: 'markets', title: 'M', markets: [{ symbol: 'A' }] } as never}
          data={{
            markets: [
              { symbol: 'A', name: 'A', price: 1, change: 1, changePct: 1, chart: [1, 2, 3] },
              { symbol: 'B', name: 'B', price: 1, change: 0, changePct: 0, chart: [2, 2, 2] },
            ],
          }}
        />
        <DnsStatsWidget
          config={{ type: 'dns-stats', title: 'D' } as never}
          data={{
            totalQueries: 10,
            blockedPercent: 20,
            responseTime: 0,
            domainsBlocked: 5,
            series: [{ queries: 10, blocked: 2, percentBlocked: 20, percentTotal: 80 }],
            timeLabels: ['12am'],
            topBlockedDomains: [],
          }}
        />
        <Timer config={{ type: 'timer', duration: '25m' } as never} data={null} />
      </>,
    );

    const seen = new Set<string>();
    for (const el of Array.from(container.querySelectorAll<HTMLElement>('*'))) {
      for (const prop of HUE_VARS) {
        const value = el.style.getPropertyValue(prop).trim();
        if (value) seen.add(value);
      }
    }
    // markets flat series, dns queries + blocked segments, timer ring arc
    expect([...seen].sort()).toEqual([CHART_HUES.cyan, CHART_HUES.muted, CHART_HUES.orange].sort());
  });

  // The invariant 0.3.1 made enforceable. Until then the kit's sparkline
  // hardcoded --dracula-* primitives while chart-hues had moved to
  // --color-data-* role tokens, so "the sparkline fill is a CHART_HUES entry"
  // was FALSE and could not be asserted — only its weaker cousin. Upstream
  // repointed it, so the two files agree again and the real contract holds:
  // one vocabulary for chart ink, no literal anywhere.
  it('paints the signed sparkline from CHART_HUES, not a raw primitive', () => {
    render(
      <Markets
        config={{ type: 'markets', markets: [{ symbol: 'A' }] } as never}
        data={{ markets: [{ symbol: 'A', name: 'A', price: 1, change: 1, changePct: 1, chart: [1, 2, 3] }] }}
      />,
    );
    const fill = screen.getByRole('img', { name: 'A price trend' }).querySelector('rect')!.getAttribute('fill')!;
    expect(fill).toBe(CHART_HUES.green);
    // and the source that produced it names no raw primitive at all
    const src = readFileSync(join(here, 'sparkline.tsx'), 'utf8');
    expect(src).not.toMatch(/var\(--dracula-/);
  });

  it('declares no hand-rolled colour in the chart widgets', () => {
    for (const name of ['markets', 'dns', 'timer']) {
      const css = chartCss(name);
      expect(css, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(css, name).not.toMatch(/\b(rgb|hsl)a?\(/);
      // purple never encodes data
      expect(css, name).not.toMatch(/categorical-purple/);
    }
  });

  it('carries the re-sync note on every vendored kit chart file', () => {
    for (const file of ['sparkline.tsx', 'chart-hues.ts', 'metric-delta.tsx']) {
      const src = readFileSync(join(here, file), 'utf8');
      expect(src, file).toMatch(/^\/\/ Vendored from astryx-dracula@[\d.]+ `shared\/[\w-]+\.\w+` \(MIT\)/);
      expect(src, file).toMatch(/re-sync this file on any kit version bump/);
    }
  });
});
