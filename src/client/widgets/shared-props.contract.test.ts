/**
 * Every widget renderer hands its chrome to the same four shared config
 * fields: `title-url`, `hide-header`, `css-class` and `show-errors`. They are
 * declared once in `sharedWidgetFields`, so a renderer that forgets one does
 * not fail to build and does not warn at runtime — the option just silently
 * does nothing. `show-errors: false` on such a widget renders the same loud
 * error banner as everywhere else, and `title-url` is ignored entirely, so
 * the config reads as if it works.
 *
 * This guard fails if that comes back. It scans the renderers' JSX rather than
 * their runtime props, because a dropped field is invisible at runtime: the
 * widget renders perfectly, just without the option the user set.
 *
 * A `<WidgetChrome {...spread} />` is exempt — the spread is resolved at
 * runtime and cannot be read statically. `_media/factory.tsx` is the one
 * module that builds a `chrome` object and spreads it, and it carries all
 * four fields on the object.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WIDGETS = 'src/client/widgets';

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });

// A test file quotes the very prop names this contract checks, so scanning it
// would make the contract depend on its own documentation.
const sources = walk(WIDGETS)
  .filter((f) => f.endsWith('.tsx'))
  .filter((f) => !f.includes('.test.'))
  .map((f) => ({ path: f, text: readFileSync(f, 'utf8') }));

interface Call {
  path: string;
  line: number;
  /** Prop names passed on the opening tag. */
  props: Set<string>;
  /** The tag spreads an object, so its real prop set is not statically known. */
  spread: boolean;
  /** Renders children or an `items` list, rather than a bare loading chrome. */
  rendersContent: boolean;
}

/** Splits a JSX opening tag on top-level whitespace, respecting `{}` nesting. */
function parseTag(tag: string): Set<string> {
  const props = new Set<string>();
  let depth = 0;
  let start = 0;
  for (let i = 0; i <= tag.length; i++) {
    const c = tag[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    if (depth > 0 || (c !== ' ' && c !== '\n' && c !== '\t' && c !== undefined)) continue;
    const word = tag.slice(start, i);
    const eq = word.indexOf('=');
    if (eq > 0) props.add(word.slice(0, eq).trim());
    start = i + 1;
  }
  return props;
}

const calls: Call[] = [];

for (const { path, text } of sources) {
  for (let i = text.indexOf('<WidgetChrome'); i !== -1; i = text.indexOf('<WidgetChrome', i + 1)) {
    // Walk to the tag's closing `>` at depth 0 so a prop value containing
    // `=>` or a JSX expression cannot truncate the tag.
    let depth = 0;
    let end = -1;
    for (let j = i + '<WidgetChrome'.length; j < text.length; j++) {
      const c = text[j]!;
      if (c === '{' || c === '(' || c === '[') depth++;
      else if (c === '}' || c === ')' || c === ']') depth--;
      else if (c === '>' && depth === 0) {
        end = j;
        break;
      }
    }
    if (end === -1) continue;
    const tag = text.slice(i, end + 1);
    const props = parseTag(tag);
    calls.push({
      path,
      line: text.slice(0, i).split('\n').length,
      props,
      spread: /\{\s*\.\.\./.test(tag),
      rendersContent: !tag.trimEnd().endsWith('/>') || props.has('items'),
    });
  }
}

const at = (c: Call) => `${c.path}:${c.line}`;

describe('widget shared-prop contract', () => {
  it('finds the renderers it is guarding', () => {
    // A silently empty scan would make every rule below pass for the wrong
    // reason, which is the one failure mode a source-scanning guard has.
    expect(calls.length).toBeGreaterThan(40);
  });

  it('passes showErrors to every chrome that receives an error', () => {
    // `show-errors: false` is a user-facing promise: render the failure
    // quietly. Dropping the prop makes the option a no-op and the widget
    // shouts exactly as loudly as its 39 siblings.
    const offenders = calls
      .filter((c) => !c.spread && c.props.has('error') && !c.props.has('showErrors'))
      .map((c) => `${at(c)} — error passed without showErrors`);
    expect(offenders).toEqual([]);
  });

  it('passes titleUrl, hideHeader and cssClass to every chrome a user actually sees', () => {
    // These three are the visible half of the contract, and both paths a user
    // can land on owe them: the content chrome, and the error chrome — which
    // replaces the whole body, so a renderer can honour them while it renders
    // happily and drop them on the branch that fires when something breaks.
    const required = ['titleUrl', 'hideHeader', 'cssClass'];
    const offenders = calls
      .filter((c) => !c.spread && (c.rendersContent || c.props.has('error')))
      .flatMap((c) => required.filter((p) => !c.props.has(p)).map((p) => `${at(c)} — chrome missing ${p}`));
    expect(offenders).toEqual([]);
  });
});
