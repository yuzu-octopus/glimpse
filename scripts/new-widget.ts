#!/usr/bin/env bun
/**
 * bun run new-widget <kebab-name>
 *
 * Scaffolds a compiling widget end-to-end:
 * - src/shared/widgets/<name>.ts (schema slice + co-located pref + skeleton)
 * - wiring in src/shared/widgets/index.ts (import, schemaEntries, widgetMeta)
 * - src/server/widgets/<name>.ts + <name>.test.ts (fetcher + fixture test)
 * - registry line in src/server/widgets/index.ts
 * - src/client/widgets/<name>/index.tsx + <name>.test.tsx (renderer + test)
 * - loader line in src/client/widgets/index.ts
 * Prints a YAML example snippet on success.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = join(dirname(new URL(import.meta.url).pathname), '..');

function fail(msg: string): never {
  console.error(`new-widget: ${msg}`);
  process.exit(1);
}

const kebab = process.argv[2];
if (!kebab) fail('usage: bun run new-widget <kebab-name>');
if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(kebab)) {
  fail(`"${kebab}" is not kebab-case (e.g. my-widget)`);
}

const pascal = kebab
  .split('-')
  .map((s) => s[0].toUpperCase() + s.slice(1))
  .join('');
const camel = pascal[0].toLowerCase() + pascal.slice(1);
const upper = kebab.replace(/-/g, '_').toUpperCase();
const schemaVar = `${camel}Schema`;
const prefVar = `${upper}_PREF`;
const skelVar = `${upper}_SKELETON`;
const defaultsVar = `${upper}_DEFAULTS`;
const configType = `${pascal}Config`;
const dataType = `${pascal}Data`;

const sharedFile = join(root, `src/shared/widgets/${kebab}.ts`);
const serverFile = join(root, `src/server/widgets/${kebab}.ts`);
const serverTest = join(root, `src/server/widgets/${kebab}.test.ts`);
const clientDir = join(root, `src/client/widgets/${kebab}`);
const clientFile = join(clientDir, 'index.tsx');
const clientTest = join(clientDir, `${kebab}.test.tsx`);

for (const f of [sharedFile, serverFile, serverTest, clientFile, clientTest]) {
  if (existsSync(f)) fail(`${f} already exists`);
}

function insertOnce(file: string, anchor: string, replacement: string): void {
  const src = readFileSync(file, 'utf8');
  if (!src.includes(anchor)) fail(`${file}: anchor not found: ${JSON.stringify(anchor)}`);
  writeFileSync(file, src.replace(anchor, replacement));
}

writeFileSync(
  sharedFile,
  `import { z } from 'zod';
import { sharedWidgetFields, type Pref, type SkeletonShape } from './shared';

export const ${defaultsVar} = { text: 'hello' } as const;
export const ${prefVar}: Pref = {
  cols: 3,
  rows: 2,
  resizable: true,
  priority: 5,
  zone: 'main',
  preferredWidth: null,
  preferredHeight: null,
};
export const ${skelVar}: SkeletonShape = 'list';

export const ${schemaVar} = z
  .object({
    type: z.literal('${kebab}'),
    ...sharedWidgetFields,
    text: z.string().default(${defaultsVar}.text),
  })
  .loose();

export type ${configType} = z.infer<typeof ${schemaVar}>;
`,
);

// Wire the schema into the shared registry (import + union entry + meta row).
const sharedIndex = join(root, 'src/shared/widgets/index.ts');
insertOnce(
  sharedIndex,
  `import type { Pref, SkeletonShape } from './shared';`,
  `import { ${schemaVar}, ${prefVar}, ${skelVar} } from './${kebab}';\nimport type { Pref, SkeletonShape } from './shared';`,
);
insertOnce(sharedIndex, `] as const;`, `  ${schemaVar},\n] as const;`);
insertOnce(
  sharedIndex,
  `} as const satisfies`,
  `  '${kebab}': { schema: ${schemaVar}, pref: ${prefVar}, skeleton: ${skelVar} },\n} as const satisfies`,
);

writeFileSync(
  serverFile,
  `import { ${schemaVar} } from '../../shared/widgets/${kebab}';
import { registerWidget } from './registry';

export interface ${dataType} {
  text: string;
}

registerWidget('${kebab}', async (_ctx, config): Promise<${dataType}> => {
  const cfg = ${schemaVar}.parse(config);
  return { text: cfg.text };
});
`,
);

writeFileSync(
  serverTest,
  `import { describe, expect, it } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './${kebab}';

function makeCtx(): WidgetFetchContext {
  return {
    fetch: globalThis.fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const fetcher = () => serverWidgets.get('${kebab}')!;

describe('${kebab} fetcher', () => {
  it('registers a fetcher', () => {
    expect(fetcher()).toBeDefined();
  });

  it('returns the default text', async () => {
    await expect(fetcher()(makeCtx(), { type: '${kebab}' })).resolves.toEqual({
      text: expect.any(String),
    });
  });

  it('returns custom text', async () => {
    await expect(
      fetcher()(makeCtx(), { type: '${kebab}', text: 'custom' }),
    ).resolves.toEqual({ text: 'custom' });
  });
});
`,
);

// Server registry: side-effect import alongside the other widgets.
const serverIndex = join(root, 'src/server/widgets/index.ts');
{
  const lines = readFileSync(serverIndex, 'utf8').split('\n');
  const last = lines.reduce((acc, l, i) => (l.startsWith("import './") ? i : acc), -1);
  if (last === -1) fail(`${serverIndex}: no side-effect imports found`);
  lines.splice(last + 1, 0, `import './${kebab}';`);
  writeFileSync(serverIndex, lines.join('\n'));
}

mkdirSync(clientDir, { recursive: true });
writeFileSync(
  clientFile,
  `import type { ${configType} } from '../../../shared/widgets/${kebab}';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';

function ${pascal}({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as ${configType};
  const payload = (data ?? {}) as Partial<{ text: string }>;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      error={error}
      isLoading={loading}
      items={[<div key="message">{payload.text ?? '…'}</div>]}
    />
  );
}

registerWidgetComponent('${kebab}', ${pascal});

export default ${pascal};
`,
);

writeFileSync(
  clientTest,
  `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ${pascal} from './index';

describe('${kebab} widget', () => {
  it('renders the fetched text', () => {
    render(<${pascal} config={{ type: '${kebab}' }} data={{ text: 'hi' }} />);
    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  it('renders nothing but chrome while loading', () => {
    render(<${pascal} config={{ type: '${kebab}' }} data={null} isLoading />);
    expect(screen.queryByText('hi')).toBeNull();
  });

  it('surfaces fetch errors via chrome', () => {
    render(<${pascal} config={{ type: '${kebab}' }} data={null} error="boom" />);
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });
});
`,
);

// Client registry: lazy loader chunk.
const clientIndex = join(root, 'src/client/widgets/index.ts');
insertOnce(
  clientIndex,
  `\n};`,
  `\n  '${kebab}': () => import('./${kebab}'),\n};`,
);

console.log(`created:
  ${sharedFile}
  ${serverFile}
  ${serverTest}
  ${clientFile}
  ${clientTest}
wired: src/shared/widgets/index.ts, src/server/widgets/index.ts, src/client/widgets/index.ts

example snippet:
  - type: ${kebab}
    text: hello
`);
