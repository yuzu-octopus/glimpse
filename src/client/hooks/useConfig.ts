import { useEffect, useState } from 'react';
import type { ResolvedConfig } from '../../shared/config';

export type ConfigState =
  | { status: 'loading' }
  | { status: 'ready'; config: ResolvedConfig }
  | { status: 'error'; error: string; errors?: string[] };

let cached: Promise<{ config: ResolvedConfig }> | null = null;

/**
 * Loads the resolved config once per session and shares it across hooks.
 * Rejected fetches are not cached: the next consumer retries.
 */
export function useConfig(): ConfigState {
  const [state, setState] = useState<ConfigState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    cached ??= fetch('/api/config')
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            errors?: string[];
          };
          // Surface the first error as the snippet so config failures point
          // at the real line instead of a joined wall of text.
          const errors = Array.isArray(body.errors)
            ? body.errors.filter((e): e is string => typeof e === 'string')
            : [];
          const first = errors[0] ?? `HTTP ${res.status}`;
          const error = (
            errors.length > 1 ? new Error(`${first} (+${errors.length - 1} more)`) : new Error(first)
          ) as Error & { errors?: string[] };
          if (errors.length > 0) error.errors = errors;
          throw error;
        }
        return (await res.json()) as { config: ResolvedConfig };
      })
      .catch((e: unknown) => {
        cached = null; // don't cache failures: next consumer retries
        throw e;
      });
    cached
      .then(({ config }) => {
        if (!cancelled) setState({ status: 'ready', config });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const errors =
            e instanceof Error ? (e as Error & { errors?: string[] }).errors : undefined;
          setState({
            status: 'error',
            error: e instanceof Error ? e.message : String(e),
            ...(errors?.length ? { errors } : {}),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
