import { readFileSync } from 'node:fs';
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

  it('keeps Enter in the same tab and opens Ctrl+Enter in a new tab by default', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderSearch();
    const input = screen.getByLabelText('Search');
    fireEvent.change(input, { target: { value: 'cats' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(open).toHaveBeenLastCalledWith('https://duckduckgo.com/?q=cats', '_self');
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
    expect(open).toHaveBeenLastCalledWith('https://duckduckgo.com/?q=dogs', '_self');
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

  it('routes bangs without a leading ! using the first word', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderSearch();
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'yt cats' } });
    fireEvent.submit(screen.getByLabelText('Search').closest('form')!);
    expect(open).toHaveBeenCalledWith(
      'https://www.youtube.com/results?search_query=cats',
      '_self',
    );
  });

  it('routes a bare shortcut to the bang engine with an empty query', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderSearch();
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'yt' } });
    fireEvent.submit(screen.getByLabelText('Search').closest('form')!);
    expect(open).toHaveBeenCalledWith('https://www.youtube.com/results?search_query=', '_self');
  });

  it('does not treat a shortcut prefix as a bang when it is not a full word', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderSearch();
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'youtube results' } });
    fireEvent.submit(screen.getByLabelText('Search').closest('form')!);
    expect(open).toHaveBeenCalledWith(
      'https://duckduckgo.com/?q=youtube%20results',
      '_self',
    );
  });

  it('supports a custom URL string as search-engine', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderSearch({
      ...CONFIG,
      'search-engine': 'https://example.com/search?q={QUERY}',
    });
    submitQuery('hello world');
    expect(open).toHaveBeenCalledWith('https://example.com/search?q=hello%20world', '_self');
  });

  it('falls back to duckduckgo for an unknown engine name', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderSearch({ ...CONFIG, 'search-engine': 'yahoo' });
    submitQuery('hello');
    expect(open).toHaveBeenCalledWith('https://duckduckgo.com/?q=hello', '_self');
  });
  it('does nothing for an empty query', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderSearch();
    fireEvent.keyDown(screen.getByLabelText('Search'), { key: 'Enter' });
    expect(open).not.toHaveBeenCalled();
  });

  it('search compact height 36-40px', () => {
    const css = readFileSync('src/client/widgets/search/search.module.css', 'utf8');
    expect(css).toMatch(/height:\s*(36|37|38|39|40)px/);
    // container or input must be 38px (task spec)
    expect(css).toContain('38px');
  });

  it('search icon is 16px', () => {
    const css = readFileSync('src/client/widgets/search/search.module.css', 'utf8');
    expect(css).toMatch(/\.icon\s*\{[^}]*width:\s*16px/);
    expect(css).toMatch(/\.icon\s*\{[^}]*height:\s*16px/);
  });
});
