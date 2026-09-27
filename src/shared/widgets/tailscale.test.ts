import { describe, expect, it } from 'vitest';
import { tailscaleSchema } from './tailscale';

describe('tailscale schema', () => {
  it('defaults tailnet to the "-" shorthand and caps the list at 20', () => {
    const cfg = tailscaleSchema.parse({ type: 'tailscale' });
    expect(cfg.tailnet).toBe('-');
    expect(cfg.limit).toBe(20);
  });

  it('leaves api-key optional so the env fallback can take over', () => {
    expect(tailscaleSchema.parse({ type: 'tailscale' })['api-key']).toBeUndefined();
    expect(tailscaleSchema.parse({ type: 'tailscale', 'api-key': 'tskey-x' })['api-key']).toBe(
      'tskey-x',
    );
  });

  it('keeps the shared fields every widget inherits', () => {
    const cfg = tailscaleSchema.parse({ type: 'tailscale', title: 'Tailnet', 'show-errors': false });
    expect(cfg.title).toBe('Tailnet');
    expect(cfg['show-errors']).toBe(false);
    expect(cfg.retries).toBe(3);
  });

  it('rejects a limit that would render an empty or unbounded list', () => {
    expect(tailscaleSchema.safeParse({ type: 'tailscale', limit: 0 }).success).toBe(false);
    expect(tailscaleSchema.safeParse({ type: 'tailscale', limit: 201 }).success).toBe(false);
    expect(tailscaleSchema.safeParse({ type: 'tailscale', limit: 1.5 }).success).toBe(false);
  });

  it('accepts an empty tailnet name (the API rejects it, not the schema)', () => {
    expect(tailscaleSchema.parse({ type: 'tailscale', tailnet: '' }).tailnet).toBe('');
  });
});
