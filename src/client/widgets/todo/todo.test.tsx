import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Todo } from './index';

function renderTodo(id = 'test') {
  return render(<Todo config={{ type: 'todo', id }} data={null} />);
}

beforeEach(() => {
  localStorage.clear();
});

describe('todo widget', () => {
  it('adds a task via the input and Add button', () => {
    renderTodo();
    fireEvent.change(screen.getByLabelText('New task'), { target: { value: 'write tests' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('checkbox', { name: 'write tests' })).toBeInTheDocument();
  });

  it('toggles completion and deletes tasks', () => {
    renderTodo();
    fireEvent.change(screen.getByLabelText('New task'), { target: { value: 'task one' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByLabelText('New task'), { target: { value: 'task two' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    // toggle the first task's checkbox
    const firstCheckbox = screen.getByRole('checkbox', { name: 'task one' });
    fireEvent.click(firstCheckbox);
    expect(firstCheckbox).toBeChecked();

    // delete the second task
    fireEvent.click(screen.getByRole('button', { name: 'Delete task two' }));
    expect(screen.queryByRole('checkbox', { name: 'task two' })).toBeNull();
  });

  it('persists tasks to localStorage under the widget id', () => {
    renderTodo('persist-key');
    fireEvent.change(screen.getByLabelText('New task'), { target: { value: 'persist me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    const stored = JSON.parse(localStorage.getItem('glimpse.todo.persist-key') ?? '[]') as { text: string }[];
    expect(stored.some((t) => t.text === 'persist me')).toBe(true);
  });

  it('restores persisted tasks on mount', () => {
    localStorage.setItem('glimpse.todo.restore-key', JSON.stringify([{ id: '1', text: 'restored', done: true }]));
    renderTodo('restore-key');
    expect(screen.getByRole('checkbox', { name: 'restored' })).toBeChecked();
  });

  it('prepends tasks added with Ctrl+Enter, Enter still appends', () => {
    const { container } = renderTodo();
    const input = screen.getByLabelText('New task');

    fireEvent.change(input, { target: { value: 'bottom' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: 'top' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    fireEvent.change(input, { target: { value: 'middle' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const texts = Array.from(container.querySelectorAll('[class*="itemText"]')).map(
      (el) => el.textContent,
    );
    expect(texts).toEqual(['top', 'bottom', 'middle']);
  });

  it('focuses the last item edit button on ArrowDown in the input', () => {
    renderTodo();
    const input = screen.getByLabelText('New task');
    fireEvent.change(input, { target: { value: 'first' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(input, { target: { value: 'last' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: 'Edit last' })).toHaveFocus();
  });
});
