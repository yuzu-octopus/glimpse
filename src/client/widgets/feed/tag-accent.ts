/**
 * Stable per-tag accent.
 *
 * The old chip styles cycled hues by `nth-child`, so the same tag was green on
 * one row and pink on the next — colour assigned by DOM position, i.e.
 * decoration rather than meaning. Hashing the tag text instead makes a
 * category keep its colour wherever it appears.
 *
 * `--color-tag-blue` is deliberately absent from the set: in the installed
 * astryx-dracula kit it is literally #BD93F9, the tappable purple, so a cycle
 * including it paints purple under another name. Yellow is the default and
 * lives on the base chip class, so it needs no entry here.
 */
export const TAG_ACCENTS = ['green', 'cyan', 'pink', 'orange'] as const;

export type TagAccent = (typeof TAG_ACCENTS)[number];

/** FNV-ish string hash, folded to a non-negative integer. */
function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/** The accent a tag always wears, derived from the tag itself. */
export function tagAccent(tag: string): TagAccent {
  return TAG_ACCENTS[hash(tag) % TAG_ACCENTS.length];
}
