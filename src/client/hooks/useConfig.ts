import { useEffect, useState } from 'react';
import type { ResolvedConfig } from '../../shared/config';

type ConfigState =
  | { status: 'loading' }
  | { status: 'ready'; config: ResolvedConfig }
  | { status: 'error'; error: string };

let cached: Promise<{ config: ResolvedConfig }> | null = null;

/** Loads the resolved config once per session and shares it across hooks. */
export function useConfig(): ConfigState {
  const [state, setState] = useState<ConfigState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    cached ??= fetch('/api/config').then(async (res) => {
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          errors?: string[];
        };
        throw new Error(body.errors?.join('; ') ?? `HTTP ${res.status}`);
      }
      return (await res.json()) as { config: ResolvedConfig };
    });
    cached
      .then(({ config }) => {
        if (!cancelled) setState({ status: 'ready', config });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            error: e instanceof Error ? e.message : String(e),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
