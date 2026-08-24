import { describe, expect, it } from 'vitest';
import { aiQuotaSchema, parseWindow } from './ai-quota';

describe('ai-quota schema', () => {
  it('accepts provider + token', () => {
    const cfg = aiQuotaSchema.parse({ type: 'ai-quota', provider: 'codex', token: 'sk' });
    expect(cfg.provider).toBe('codex');
  });
  it('rejects unknown provider', () => {
    expect(() => aiQuotaSchema.parse({ type: 'ai-quota', provider: 'bad' as never })).toThrow();
  });
});
describe('parseWindow', () => {
  it('maps primary_window {used_percent, limit_window_seconds, reset_at} to RateWindow', () => {
    const w = parseWindow({ used_percent: 15, limit_window_seconds: 18000, reset_at: 1735401600 }, 'primary');
    expect(w.usedPercent).toBe(15);
    expect(w.windowMinutes).toBe(300);
    expect(w.resetsAt).toBe(1735401600 * 1000);
  });
  it('maps longCat total/remaining to usedPercent', () => {
    const w = parseWindow({ total: 100, remaining: 40 }, 'total-remaining');
    expect(w.usedPercent).toBe(60);
  });
});
