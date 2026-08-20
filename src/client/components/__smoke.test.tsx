import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Dialog, DialogHeader, SegmentedControl, SegmentedControlItem, SelectableCard } from '@astryxdesign/core';
import { describe, expect, it } from 'vitest';

function Smoke() {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState('a');
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <Dialog isOpen={open} onOpenChange={setOpen} width={560}>
        <DialogHeader title="Settings" onOpenChange={setOpen} />
        <div>
          <SegmentedControl value="system" onChange={() => {}} label="Color mode">
            <SegmentedControlItem value="system" label="System" />
            <SegmentedControlItem value="light" label="Light" />
          </SegmentedControl>
          <SelectableCard label="A" isSelected={sel === 'a'} onChange={(v) => v && setSel('a')} padding={1}>
            <span>A</span>
          </SelectableCard>
          <SelectableCard label="B" isSelected={sel === 'b'} onChange={(v) => v && setSel('b')} padding={1}>
            <span>B</span>
          </SelectableCard>
        </div>
      </Dialog>
    </>
  );
}

describe('smoke', () => {
  it('renders dialog and selects a card', () => {
    render(<Smoke />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    // closed dialog content is not in the a11y tree — open it first
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    expect(document.querySelector('dialog')?.open).toBe(true);
    expect(screen.getByRole('radio', { name: 'Light' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'B' }));
    expect(screen.getByRole('checkbox', { name: 'B' })).toBeChecked();
    // close via DialogHeader close button
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.querySelector('dialog')?.open).toBe(false);
  });
});
