import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Iframe from './index';

describe('iframe widget', () => {
  it('renders the source frameless with the configured height as min-height', () => {
    render(
      <Iframe
        config={{ type: 'iframe', title: 'Embed', source: 'https://example.com', height: 200 }}
        data={null}
      />,
    );
    const frame = screen.getByTitle('Embed') as HTMLIFrameElement;
    expect(frame.getAttribute('src')).toBe('https://example.com');
    expect(frame.getAttribute('height')).toBeNull();
    expect(frame.style.minHeight).toBe('200px');
  });

  it('defaults the min-height when no height is configured', () => {
    render(
      <Iframe config={{ type: 'iframe', source: 'https://example.com' }} data={null} />,
    );
    const frame = screen.getByTitle('Embedded content') as HTMLIFrameElement;
    expect(frame.style.minHeight).toBe('300px');
  });
});
