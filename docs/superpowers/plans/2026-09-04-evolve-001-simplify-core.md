# 001 — Simplify Core (quota table, palette unify, PREF co-locate)

Base: `e2c784d`. Status: TODO (awaiting approval; do not execute yet).

## Why

Ponytail audit net −1900 lines / −3 deps. Three cuts are safe, tested, no visual change. Contested cuts (SWR, router, systeminformation, retry) explicitly OUT — keep as-is.

## Task A — Quota providers to table

Files in scope: `src/server/quota/providers/*`, `src/server/quota/index.ts`, `src/server/quota/*.test.ts`.
Out of scope: quota-types, ai-quota widget, auth semantics.

1. Inventory each provider: url, authKind (bearer/cookie/file/cli), map fn. Mark outliers: grok CLI probe, opencode dual-path, gemini/vertex ADC.
2. Add `providerTable.ts`: rows `{id, url, authKind, map}` + generic `fetchTableRow`. Keep outlier files bespoke.
3. Rewrite `index.ts` PROVIDERS from table; keep ENV_KEYS/FILE_DEFAULTS behavior identical.
4. Run per-provider tests: `bun run test src/server/quota` — all green, coverage 69/69 intact.
5. Commit `refactor(quota): table-driven providers`.

Done: `bunx tsc --noEmit` clean, quota tests pass, `mapped keys == KNOWN_PROVIDERS` (0 missing), no provider behavior change. If a provider's mapping is genuinely custom (not table-shaped), STOP and keep it bespoke instead of forcing it.

## Task B — Palette unify

Files: `src/shared/theme/glimpseTheme.ts`, `glanceHsl.ts`, `presets.ts`, theme tests.
Out: provider, components, tokens consumed by Astryx.

1. Snapshot current outputs: run theme tests, save palette hexes for 3 presets + 1 HSL block.
2. Route all entries through one `seed → colors → ramp` path (`sourceFromBase16` core; HSL/classic adapt to seed).
3. Delete dead shims; keep `glanceHsl` compat + `contrast-multiplier` ignore (settled).
4. Tests green + snapshot hexes byte-identical.

Done: tsc clean, theme tests pass, zero palette diff. If any preset shifts color, STOP and report.

## Task C — PREF co-locate

Files: `src/shared/widgets/*.ts`, `index.ts`, `preferredSizes.ts`, widget tests.
Out: renderers, fetchers.

1. Add `pref` + `skeleton` fields beside each schema; derive PREFERRED_SIZES/SKELETON_SHAPE maps.
2. Delete parallel registry + `assertAllWidgetsCovered` (replace with derivation test).
3. Tests green, incl. missing-widget coverage test.

Done: tsc clean, full `bun run test` green. If derivation breaks lazy typing, STOP.

## Verification (all tasks)

`bunx tsc --noEmit` · `bun run test` · `npx react-doctor@latest` 100/100.

## Maintenance

Future widgets declare pref with schema (generator in 003 enforces). Palette changes snapshot-test. Provider additions are table rows.
