import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchConfig } from '../../../shared/widgets/search';
import { Search } from './index';

const CONFIG: SearchConfig = {
  type: 'search',
  'search-engine': { name: 'DDG', url: 'https://duckduckgo.com/?q={QUERY}' },
  bangs: [
    { title: 'GitHub', shortcut: 'gh', url: 'https://github.com/search?q={QUERY}' },
  ],
};

function renderSearch(config = CONFIG) {
  return render(<Search config={config} data={null} />);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('search widget', () => {
  it('focuses the input when the s shortcut is pressed', () => {
    renderSearch();
    const input = screen.getByLabelText('Search');
    input.blur();
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(window, { key: 's' });
    expect(document.activeElement).toBe(input);
  });

  it('does not hijack the shortcut while typing', () => {
    renderSearch();
    const input = screen.getByLabelText('Search');
    input.focus();
    // typing 's' inside the input must not re-focus (no preventDefault loop)
    const prevented = fireEvent.keyDown(input, { key: 's' });
    expect(prevented).toBe(true);
  });

  it('opens the engine URL with the query substituted', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderSearch();
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'hello world' } });
    fireEvent.submit(screen.getByLabelText('Search').closest('form')!);
    expect(open).toHaveBeenCalledWith('https://duckduckgo.com/?q=hello%20world', '_self');
  });

  it('routes bang queries to the matching bang url', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderSearch();
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '!gh astryx' } });
    fireEvent.submit(screen.getByLabelText('Search').closest('form')!);
    expect(open).toHaveBeenCalledWith('https://github.com/search?q=astryx', '_self');
  });

  it('opens in a new tab when new-tab is configured', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderSearch({ ...CONFIG, 'new-tab': true });
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'x' } });
    fireEvent.submit(screen.getByLabelText('Search').closest('form')!);
    expect(open).toHaveBeenCalledWith(expect.any(String), '_blank', 'noopener,noreferrer');
  });
});
