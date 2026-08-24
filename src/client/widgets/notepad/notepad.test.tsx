import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Notepad } from './index';

beforeEach(() => localStorage.clear());

describe('notepad widget', () => {
  it('renders and persists text to localStorage', () => {
    render(<Notepad config={{ type: 'notepad', id: 'a' } as unknown as Record<string, unknown>} data={null} />);
    const area = screen.getByTestId('notepad-area') as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: 'hello' } });
    expect(area.value).toBe('hello');
    expect(localStorage.getItem('glimpse.notepad.a')).toBe('hello');
  });

  it('restores persisted text on mount', () => {
    localStorage.setItem('glimpse.notepad.b', 'saved');
    render(<Notepad config={{ type: 'notepad', id: 'b' } as unknown as Record<string, unknown>} data={null} />);
    expect((screen.getByTestId('notepad-area') as HTMLTextAreaElement).value).toBe('saved');
  });
});
