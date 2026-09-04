# 003 — Widget DX (generator, single registry, validate CLI, errors)

Base: `e2c784d`. Depends on 001. Status: TODO.

## Why

New widget = 5–6 files + 3 tests + 2 hand registries; miss a line = silent absence. Config errors lack line numbers; no check CLI; dual YAML parsers diverge.

## Tasks

1. **Generator** `bun run new-widget <kebab-name>`: scaffolds schema slice (+pref per 001), server fetcher w/ fixture test, client renderer w/ test, both registry lines, example snippet. Exemplar: `src/server/widgets/rss.test.ts` + `contribution-graph` files.
2. **Registry guard**: build-time test that every WidgetType has server import + client loader (fail loudly, not silent null).
3. **Validate CLI** `bun run check-config [path]`: prints line-numbered YAML + zod errors with hints + did-you-mean widget types.
4. **Error UX**: surface first-error snippet in `useConfig`; `${VAR:-fallback}` default syntax; warn (not drop) on non-pages/theme $include keys.
5. **Parser conformance**: one conformance test locking Bun.YAML vs fallback agreement; fallback lives test-only eventually.

Out: visual changes, new widgets, tiling.

## Done

Generator creates a compiling widget end-to-end; `check-config` catches typo'd type with suggestion; tests green; doctor clean. If CLI shape is contested, STOP and ask.
