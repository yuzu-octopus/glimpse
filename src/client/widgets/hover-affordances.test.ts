import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Hover affordances are the one class of style that jsdom cannot exercise:
// it matches no pseudo-class. The stylesheet is therefore the surface under
// test, the same way dns.test.tsx reads its own module. What is asserted is
// the doctrine from the brand kit — hover dims, press dims more, focus rings
// the control, cards and thumbnails are static — and not any value.

const dir = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(dir, rel), 'utf8');

/** Every rule in the sheet as { selector, body }, unwrapping @media blocks. */
function rules(sheet: string): Array<{ selector: string; body: string }> {
  // A comment names the rule it precedes, so an unstripped parse reads a
  // commented-out `:hover` as a live selector.
  const src = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Array<{ selector: string; body: string }> = [];
  let buf = '';
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '{') {
      const selector = buf.trim();
      buf = '';
      let depth = 1;
      let body = '';
      for (let j = i + 1; j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') {
          if (--depth === 0) {
            body = src.slice(i + 1, j);
            i = j;
            break;
          }
        } else if (depth === 1) body += src[j];
      }
      if (selector && !selector.startsWith('@')) out.push({ selector, body });
    } else if (src[i] !== '}') buf += src[i];
  }
  return out;
}

/** The body of the first `@media (hover: hover) { … }` block, brace-matched. */
function pointerOnly(src: string): string | undefined {
  const at = src.indexOf('@media (hover: hover)');
  if (at < 0) return undefined;
  for (let i = at, depth = 0; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(at, i + 1);
  }
  return undefined;
}

const REST_DIMMED = ['custom-api/custom-api.module.css', 'rss/rss.module.css', 'reddit/reddit.module.css'];
const NO_HOVER_ONLY = [
  ...REST_DIMMED,
  'monitor/monitor.module.css',
  'feed/feed.module.css',
  'dns/dns.module.css',
];

describe('hover affordances are not hover-only', () => {
  it.each(NO_HOVER_ONLY)('%s pairs every :hover with a focus channel', (rel) => {
    const orphans = rules(read(rel))
      .filter((r) => r.selector.includes(':hover') && !r.selector.includes(':focus'))
      .map((r) => r.selector);
    expect(orphans, `${rel} reveals something on :hover alone`).toEqual([]);
  });

  it.each(REST_DIMMED)('%s dims at rest only where a pointer can undo it', (rel) => {
    const src = read(rel);
    const gated = pointerOnly(src);
    expect(gated, `${rel} needs @media (hover: hover)`).toBeDefined();
    expect(gated).toContain('filter: grayscale(0.2) contrast(0.9)');
    // nothing outside the gate may dim, or a touch device keeps it dimmed
    const ungated = src.replace(gated!, '');
    expect(ungated).not.toContain('grayscale');
    expect(ungated).not.toContain('opacity: 0.8');
  });

  it.each(NO_HOVER_ONLY)('%s never lifts on hover', (rel) => {
    const lifts = rules(read(rel))
      .filter((r) => /transform:\s*scale/.test(r.body))
      .map((r) => r.selector);
    expect(lifts, `${rel} scales a card on hover; the doctrine is hover dims`).toEqual([]);
  });

  it('keeps the auto-invert glyph visible through the hover that outranks it', () => {
    // `.row:hover .icon` is (0,2,0) and beats a bare `.iconAutoInvert` at
    // (0,1,0), so an un-guarded hover rule un-inverts exactly the simple-icons
    // and mdi glyphs that cannot render without the invert.
    const src = read('monitor/monitor.module.css');
    const dim = src.indexOf('filter: grayscale(0)');
    const invert = src.indexOf('.row:is(:hover, :focus-within) .iconAutoInvert');
    expect(dim).toBeGreaterThan(-1);
    expect(invert).toBeGreaterThan(dim);
    expect(src.slice(invert)).toContain('filter: invert(1)');
  });
});
