import { describe, expect, it } from 'vitest';
import { aiQuotaSchema } from './ai-quota';

describe('ai-quota schema', () => {
  it('accepts provider + token', () => {
    const cfg = aiQuotaSchema.parse({ type: 'ai-quota', provider: 'codex', token: 'sk' });
    expect(cfg.provider).toBe('codex');
  });
  it('rejects unknown provider', () => {
    expect(() => aiQuotaSchema.parse({ type: 'ai-quota', provider: 'bad' as never })).toThrow();
  });
});
