import { describe, expect, it } from 'vitest';
import { aiQuotaSchema } from './ai-quota';

describe('ai-quota schema', () => {
  it('accepts a provider and takes no token', () => {
    const cfg = aiQuotaSchema.parse({ type: 'ai-quota', provider: 'codex' });
    expect(cfg.provider).toBe('codex');
    // Stripped, not passed through: the config is handed to the browser whole.
    const withToken = aiQuotaSchema.parse({ type: 'ai-quota', provider: 'codex', token: 'leaked' });
    expect('token' in withToken).toBe(false);
    expect(JSON.stringify(withToken)).not.toContain('leaked');
  });
  it('keeps tokenFile — a credential path, not a secret', () => {
    const cfg = aiQuotaSchema.parse({ type: 'ai-quota', tokenFile: '/home/u/.codex/auth.json' });
    expect(cfg.tokenFile).toBe('/home/u/.codex/auth.json');
  });
  it('rejects unknown provider', () => {
    expect(() => aiQuotaSchema.parse({ type: 'ai-quota', provider: 'bad' as never })).toThrow();
  });
});
