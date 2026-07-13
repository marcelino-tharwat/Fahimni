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

describe('Modal — responsive fit on short/mobile viewports', () => {
  it('caps the dialog height and makes it independently scrollable', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Test modal">
        <p>content</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toMatch(/max-h-\[85vh\]/);
    expect(dialog.className).toMatch(/overflow-y-auto/);
  });

  it('still closes when the backdrop (not the dialog) is clicked, despite the extra centering wrapper', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Test modal">
        <button type="button">action</button>
      </Modal>,
    );
    // The centering wrapper sits between the backdrop and the dialog; a click
    // there must still bubble up to the backdrop's close handler.
    const dialog = screen.getByRole('dialog');
    const centeringWrapper = dialog.parentElement!;
    fireEvent.click(centeringWrapper);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the dialog itself', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Test modal">
        <button type="button">action</button>
      </Modal>,
    );
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
