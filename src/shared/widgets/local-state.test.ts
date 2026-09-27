import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../server/config';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hasLocalState, localStateKey, LOCAL_STATE_TYPES } from './local-state';
import type { ResolvedConfig } from '../config';

function loadYaml(yaml: string) {
  const dir = mkdtempSync(join(tmpdir(), 'glimpse-ids-'));
  const file = join(dir, 'config.yml');
  writeFileSync(file, yaml);
  const result = loadConfig(file);
  if (!result.ok) throw new Error((result.errors ?? []).join('\n'));
  return result.config!;
}

/** The widget records of a page, in document order, depth-first. */
function widgetsOf(config: ResolvedConfig, pageSlug: string) {
  const page = config.pages.find((p) => p.slug === pageSlug)!;
  const out: Record<string, unknown>[] = [];
  const walk = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const w of list as Record<string, unknown>[]) {
      out.push(w);
      walk(w.widgets);
    }
  };
  for (const col of page.columns ?? []) walk(col.widgets);
  walk(page['head-widgets']);
  return out;
}

const NOTEPADS = `
pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: notepad
          - type: notepad
          - type: notepad
`;

describe('local state keys', () => {
  it('falls back to `default` for a widget with no id', () => {
    expect(localStateKey('notepad', undefined)).toBe('glimpse.notepad.default');
    expect(localStateKey('todo', 'work')).toBe('glimpse.todo.work');
  });

  it('recognises the three stateful widgets, aliases folded', () => {
    for (const t of LOCAL_STATE_TYPES) expect(hasLocalState(t)).toBe(true);
    expect(hasLocalState('to-do')).toBe(true);
    expect(hasLocalState('clock')).toBe(false);
    expect(hasLocalState(undefined)).toBe(false);
  });
});

describe('derived widget ids', () => {
  // Three notepads with no `id:` all resolved to `glimpse.notepad.default` and
  // shared one blob, so typing in any of them overwrote the other two.
  it('gives each same-page instance its own key', () => {
    const ids = widgetsOf(loadYaml(NOTEPADS), 'home').map((w) => w.id);
    expect(ids[1]).toBe('home.notepad.2');
    expect(ids[2]).toBe('home.notepad.3');
    // localStorage is per-origin and shared across pages, so the key has to
    // carry the page too — the same notepad on two pages is two instances.
    expect(new Set(ids.map((id) => localStateKey('notepad', id as string | undefined))).size).toBe(3);
  });

  // Re-keying the first instance would orphan every note, task and in-flight
  // timer in every existing install, and it never collided with anything.
  it('leaves the first instance on a page on the key it has always owned', () => {
    const [first] = widgetsOf(loadYaml(NOTEPADS), 'home');
    expect(first!.id).toBeUndefined();
    expect(localStateKey('notepad', first!.id as string | undefined)).toBe('glimpse.notepad.default');
  });

  it('scopes the derived key per page', () => {
    const yaml = `
pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: notepad
          - type: notepad
  - name: Lab
    columns:
      - size: full
        widgets:
          - type: notepad
          - type: notepad
`;
    const config = loadYaml(yaml);
    const home = widgetsOf(config, 'home').map((w) => w.id);
    const lab = widgetsOf(config, 'lab').map((w) => w.id);
    expect(home[1]).not.toBe(lab[1]);
    expect(home[1]).toBe('home.notepad.2');
    expect(lab[1]).toBe('lab.notepad.2');
  });

  it('never overrides an id the config set itself', () => {
    const yaml = `
pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: notepad
            id: mine
          - type: notepad
`;
    const ids = widgetsOf(loadYaml(yaml), 'home').map((w) => w.id);
    expect(ids[0]).toBe('mine');
    expect(ids[1]).toBeUndefined();
  });

  // A group container is where a second notepad realistically hides.
  it('descends into group containers', () => {
    const yaml = `
pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: notepad
          - type: group
            widgets:
              - type: notepad
          - type: split-column
            widgets:
              - type: notepad
              - type: notepad
`;
    const ids = widgetsOf(loadYaml(yaml), 'home')
      .filter((w) => w.type === 'notepad')
      .map((w) => w.id);
    expect(ids).toEqual([undefined, 'home.notepad.2', 'home.notepad.3', 'home.notepad.4']);
  });

  it('leaves widgets that hold no browser state alone', () => {
    const yaml = `
pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: clock
          - type: clock
          - type: search
`;
    const ids = widgetsOf(loadYaml(yaml), 'home').map((w) => w.id);
    expect(ids).toEqual([undefined, undefined, undefined]);
  });

  it('counts a glance `to-do` as the todo it becomes', () => {
    const yaml = `
pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: to-do
          - type: to-do
`;
    const ids = widgetsOf(loadYaml(yaml), 'home').map((w) => w.id);
    expect(ids[0]).toBeUndefined();
    expect(ids[1]).toBe('home.to-do.2');
  });

  it('gives head-widgets an identity too', () => {
    const yaml = `
pages:
  - name: Home
    head-widgets:
      - type: notepad
      - type: notepad
    columns:
      - size: full
        widgets:
          - type: clock
`;
    // widgetsOf reads columns before head-widgets, so the clock leads.
    const ids = widgetsOf(loadYaml(yaml), 'home').map((w) => w.id);
    expect(ids).toEqual([undefined, undefined, 'home.notepad.2']);
  });
});
