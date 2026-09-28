import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchConfig } from '../../../shared/widgets/search';
import { Search } from './index';

const CONFIG: SearchConfig = {
  type: 'search',
  'search-engine': { name: 'DDG', url: 'https://duckduckgo.com/?q={QUERY}' },
  bangs: [
    { title: 'GitHub', shortcut: 'gh', url: 'https://github.com/search?q={QUERY}' },
    { title: 'YouTube', shortcut: 'yt', url: 'https://www.youtube.com/results?search_query={QUERY}' },
  ],
  'new-tab': true,
  retries: 3,
  'show-errors': true,
};

function renderSearch(config = CONFIG) {
  return render(<Search config={config} data={null} />);
}

function submitQuery(value: string) {
  fireEvent.change(screen.getByLabelText('Search'), { target: { value } });
  fireEvent.submit(screen.getByLabelText('Search').closest('form')!);
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

  it('renders the configured shortcut in the kbd hint', () => {
    renderSearch({ ...CONFIG, key: 'k' });
    const kbd = screen.getByText('K');
    expect(kbd.tagName).toBe('KBD');
    expect(kbd).toHaveAttribute('title', 'Press [K] to focus the search input');
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
    expect(open).toHaveBeenCalledWith('https://duckduckgo.com/?q=hello%20world', '_blank', 'noopener,noreferrer');
  });

  it('routes bang queries to the matching bang url', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderSearch();
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '!gh astryx' } });
    fireEvent.submit(screen.getByLabelText('Search').closest('form')!);
    expect(open).toHaveBeenCalledWith('https://github.com/search?q=astryx', '_blank', 'noopener,noreferrer');
  });

  it('keeps Enter in the same tab and opens Ctrl+Enter in a new tab by default', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderSearch({ ...CONFIG, 'new-tab': false });
    const input = screen.getByLabelText('Search');
    fireEvent.change(input, { target: { value: 'cats' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(open).toHaveBeenLastCalledWith('https://duckduckgo.com/?q=cats', '_self', 'noopener,noreferrer');
    fireEvent.change(input, { target: { value: 'dogs' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    expect(open).toHaveBeenLastCalledWith(
      'https://duckduckgo.com/?q=dogs',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('swaps Enter and Ctrl+Enter when new-tab is configured', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderSearch({ ...CONFIG, 'new-tab': true });
    const input = screen.getByLabelText('Search');
    fireEvent.change(input, { target: { value: 'cats' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(open).toHaveBeenLastCalledWith(
      'https://duckduckgo.com/?q=cats',
      '_blank',
      'noopener,noreferrer',
    );
    fireEvent.change(input, { target: { value: 'dogs' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    expect(open).toHaveBeenLastCalledWith('https://duckduckgo.com/?q=dogs', '_self', 'noopener,noreferrer');
  });

  it('respects the target option when opening a new tab', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderSearch({ ...CONFIG, 'new-tab': true, target: '_top' });
    submitQuery('cats');
    expect(open).toHaveBeenCalledWith(
      'https://duckduckgo.com/?q=cats',
      '_top',
      'noopener,noreferrer',
    );
  });

  it('blurs the input on Escape', () => {
    renderSearch();
    const input = screen.getByLabelText('Search');
    input.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(document.activeElement).not.toBe(input);
  });

  it('restores the last submitted query on ArrowUp', () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    renderSearch();
    const input = screen.getByLabelText('Search');
    submitQuery('hello world');
    expect(input).toHaveValue('');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('hello world');
  });

  it('does nothing for an empty query', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderSearch();
    fireEvent.keyDown(screen.getByLabelText('Search'), { key: 'Enter' });
    expect(open).not.toHaveBeenCalled();
  });
});

