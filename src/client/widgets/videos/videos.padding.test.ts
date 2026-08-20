import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('videos cardTitle padding regression', () => {
  it('has padding on .cardTitle (glance .video-card-contents)', () => {
    const css = readFileSync('src/client/widgets/videos/videos.module.css', 'utf8');
    const m = css.match(/\.cardTitle\s*\{[^}]*\}/s);
    expect(m).not.toBeNull();
    // must contain padding so title text does not touch image edge
    expect(m![0]).toMatch(/padding\s*:/);
    // ensure padding includes horizontal 10px (8px 10px or 10px)
    expect(m![0]).toMatch(/padding\s*:[^;]*10px/);
  });

  it('has padding or margin spacing on .cardMeta', () => {
    const css = readFileSync('src/client/widgets/videos/videos.module.css', 'utf8');
    const m = css.match(/\.cardMeta\s*\{[^}]*\}/s);
    expect(m).not.toBeNull();
    expect(m![0]).toMatch(/(padding|margin)\s*:/);
  });
});
