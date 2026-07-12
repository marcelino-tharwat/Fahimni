// @vitest-environment jsdom
import { useState, useRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Modal } from './Modal';

afterEach(() => cleanup());

/**
 * Mirrors a real caller: `onClose` is a fresh inline arrow function on every
 * render (`() => setOpen(false)`), and typing into the modal's field updates
 * parent state, forcing a re-render on every keystroke. Regression coverage
 * for a bug where the focus/tab-trap effect depended on `onClose` and tore
 * down + rebuilt on every keystroke, stealing focus back to the first
 * focusable element (the close button) — from which pressing Space would
 * "click" it and close the modal.
 */
function HostWithTextarea() {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState('');
  return (
    <Modal isOpen={open} onClose={() => setOpen(false)} title="Test modal">
      <textarea
        aria-label="notes"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </Modal>
  );
}

describe('Modal — focus stability while typing', () => {
  it('keeps focus in the field while typing multiple characters', () => {
    render(<HostWithTextarea />);
    const textarea = screen.getByLabelText('notes');
    textarea.focus();
    expect(textarea).toHaveFocus();

    for (const char of ['a', 'b', 'c']) {
      fireEvent.change(textarea, { target: { value: (textarea as HTMLTextAreaElement).value + char } });
      expect(textarea).toHaveFocus();
    }
  });

  it('does not close the modal when Space is pressed while typing', () => {
    render(<HostWithTextarea />);
    const textarea = screen.getByLabelText('notes');
    textarea.focus();
    fireEvent.change(textarea, { target: { value: 'a' } });
    fireEvent.keyDown(textarea, { key: ' ' });

    // Modal content (the field) must still be present/rendered.
    expect(screen.getByLabelText('notes')).toBeInTheDocument();
  });

  it('still closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Test modal">
        <button type="button">action</button>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('initialFocusRef focuses a custom element instead of the close button', () => {
    function Host() {
      const ref = useRef<HTMLTextAreaElement>(null);
      const [open, setOpen] = useState(true);
      return (
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Test" initialFocusRef={ref}>
          <textarea ref={ref} aria-label="custom" />
        </Modal>
      );
    }
    render(<Host />);
    const textarea = screen.getByLabelText('custom');
    expect(textarea).toHaveFocus();
  });
});
