import { describe, expect, it } from 'vitest';
import { KNOWN_PROVIDERS } from '../../shared/widgets/quota-types';
import { PROVIDERS } from './index';
import { PROVIDER_TABLE } from './providers/providerTable';

const BESPOKE = ['codex', 'claude', 'openai', 'anthropic', 'copilot', 'opencode', 'opencode-go', 'gemini', 'vertex', 'grok'];

describe('quota provider coverage', () => {
  it('mapped keys == KNOWN_PROVIDERS (0 missing)', () => {
    const missing = (KNOWN_PROVIDERS as readonly string[]).filter((p) => !PROVIDERS[p]);
    expect(missing).toEqual([]);
    expect(Object.keys(PROVIDERS).sort()).toEqual([...(KNOWN_PROVIDERS as readonly string[])].sort());
  });
  it('table rows are unique and cover every non-bespoke provider', () => {
    const ids = PROVIDER_TABLE.map((r) => r.id);
    const seen: Record<string, true> = {};
    for (const id of ids) {
      expect(seen[id]).toBeUndefined();
      seen[id] = true;
    }
    expect([...ids, ...BESPOKE].sort()).toEqual([...(KNOWN_PROVIDERS as readonly string[])].sort());
  });
});
