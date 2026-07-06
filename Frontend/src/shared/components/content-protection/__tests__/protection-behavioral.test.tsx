// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, cleanup as rtlCleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ProtectedContent } from '../ProtectedContent';
import { useTabVisibilityBlur } from '../useTabVisibilityBlur';
import { PrivacyBlurOverlay } from '../PrivacyBlurOverlay';

const mockDispatch = vi.fn();
const mockUseAppSelector = vi.fn();

vi.mock('@/shared/store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (...args: unknown[]) => (mockUseAppSelector as Mock)(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAppSelector.mockReset();
});

afterEach(() => {
  rtlCleanup();
});

function getProtectedContainer(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement;
}

// ── 1. Copy blocking ──

describe('copy blocking', () => {
  it('prevents default on copy event when disableCopy is true', () => {
    const { container } = render(
      <ProtectedContent policy={{ disableCopy: true }}>
        <p>text</p>
      </ProtectedContent>,
    );
    const el = getProtectedContainer(container);
    const event = new Event('copy', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does NOT block copy when disableCopy is false/omitted', () => {
    const { container } = render(
      <ProtectedContent policy={{}}>
        <p>text</p>
      </ProtectedContent>,
    );
    const el = getProtectedContainer(container);
    const event = new Event('copy', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

// ── 2. Cut blocking ──

describe('cut blocking', () => {
  it('prevents default on cut event when disableCut is true', () => {
    const { container } = render(
      <ProtectedContent policy={{ disableCut: true }}>
        <p>text</p>
      </ProtectedContent>,
    );
    const el = getProtectedContainer(container);
    const event = new Event('cut', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does NOT block cut when disableCut is false/omitted', () => {
    const { container } = render(
      <ProtectedContent policy={{}}>
        <p>text</p>
      </ProtectedContent>,
    );
    const el = getProtectedContainer(container);
    const event = new Event('cut', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

// ── 3. Paste blocking + gated-off companion ──

describe('paste blocking', () => {
  it('prevents default on paste event when disablePaste is true', () => {
    const { container } = render(
      <ProtectedContent policy={{ disablePaste: true }}>
        <p>text</p>
      </ProtectedContent>,
    );
    const el = getProtectedContainer(container);
    const event = new Event('paste', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does NOT block paste when disablePaste is false/omitted', () => {
    const { container } = render(
      <ProtectedContent policy={{}}>
        <p>text</p>
      </ProtectedContent>,
    );
    const el = getProtectedContainer(container);
    const event = new Event('paste', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

// ── 4. Contextmenu blocking ──

describe('contextmenu blocking', () => {
  it('prevents default on contextmenu event when disableContextMenu is true', () => {
    const { container } = render(
      <ProtectedContent policy={{ disableContextMenu: true }}>
        <p>text</p>
      </ProtectedContent>,
    );
    const el = getProtectedContainer(container);
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does NOT block contextmenu when disableContextMenu is false/omitted', () => {
    const { container } = render(
      <ProtectedContent policy={{}}>
        <p>text</p>
      </ProtectedContent>,
    );
    const el = getProtectedContainer(container);
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

// ── 5. Keyboard shortcut blocking ──

describe('keyboard shortcut blocking', () => {
  it('blocks Ctrl+C (copy) when disableCopy is true', () => {
    const { container } = render(
      <ProtectedContent policy={{ disableCopy: true }}>
        <p>text</p>
      </ProtectedContent>,
    );
    const el = getProtectedContainer(container);
    const event = new KeyboardEvent('keydown', {
      key: 'c',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('blocks Cmd+C (mac copy) when disableCopy is true', () => {
    const { container } = render(
      <ProtectedContent policy={{ disableCopy: true }}>
        <p>text</p>
      </ProtectedContent>,
    );
    const el = getProtectedContainer(container);
    const event = new KeyboardEvent('keydown', {
      key: 'c',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('blocks Ctrl+P (print) when disablePrint is true', () => {
    const { container } = render(
      <ProtectedContent policy={{ disablePrint: true }}>
        <p>text</p>
      </ProtectedContent>,
    );
    const el = getProtectedContainer(container);
    const event = new KeyboardEvent('keydown', {
      key: 'p',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does NOT block Ctrl+C when disableCopy is false', () => {
    const { container } = render(
      <ProtectedContent policy={{ disablePrint: true }}>
        <p>text</p>
      </ProtectedContent>,
    );
    const el = getProtectedContainer(container);
    const event = new KeyboardEvent('keydown', {
      key: 'c',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('does NOT block isolated letter key (no modifier)', () => {
    const { container } = render(
      <ProtectedContent policy={{ disableCopy: true, disablePrint: true }}>
        <p>text</p>
      </ProtectedContent>,
    );
    const el = getProtectedContainer(container);
    const event = new KeyboardEvent('keydown', {
      key: 'c',
      ctrlKey: false,
      metaKey: false,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

// ── 6. Textarea not blocked by disableSelection ──

describe('textarea accessibility with disableSelection', () => {
  it('does not set user-select: none on the textarea itself', () => {
    const { container } = render(
      <ProtectedContent policy={{ disableSelection: true }}>
        <textarea data-testid="essay" />
      </ProtectedContent>,
    );
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.style.userSelect).toBe('');
  });

  it('allows typing into the textarea', () => {
    const { container } = render(
      <ProtectedContent policy={{ disableSelection: true }}>
        <textarea data-testid="essay" />
      </ProtectedContent>,
    );
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'نص المقال الطويل' } });
    expect(textarea.value).toBe('نص المقال الطويل');
  });

  it('applies user-select: none on the container div', () => {
    const { container } = render(
      <ProtectedContent policy={{ disableSelection: true }}>
        <textarea data-testid="essay" />
      </ProtectedContent>,
    );
    const el = getProtectedContainer(container);
    expect(el.style.userSelect).toBe('none');
  });
});

// ── 7. Event listener cleanup on unmount ──

describe('event listener cleanup', () => {
  it('stops preventing copy after component unmounts', () => {
    const { container, unmount } = render(
      <ProtectedContent policy={{ disableCopy: true }}>
        <p>text</p>
      </ProtectedContent>,
    );
    const el = getProtectedContainer(container);

    const beforeUnmount = new Event('copy', { bubbles: true, cancelable: true });
    el.dispatchEvent(beforeUnmount);
    expect(beforeUnmount.defaultPrevented).toBe(true);

    unmount();

    const afterUnmount = new Event('copy', { bubbles: true, cancelable: true });
    el.dispatchEvent(afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);
  });

  it('does not throw when dispatching events on unmounted element', () => {
    const { container, unmount } = render(
      <ProtectedContent policy={{ disableCopy: true, disableCut: true, disablePaste: true }}>
        <p>text</p>
      </ProtectedContent>,
    );
    const el = getProtectedContainer(container);
    unmount();

    expect(() => {
      el.dispatchEvent(new Event('copy', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new Event('cut', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true }));
    }).not.toThrow();
  });
});

// ── 8. useTabVisibilityBlur fires on visibility change ──

describe('useTabVisibilityBlur runtime behavior', () => {
  function TestHarness() {
    const isHidden = useTabVisibilityBlur();
    return (
      <div>
        <span data-testid="hidden-value">{String(isHidden)}</span>
        <PrivacyBlurOverlay />
      </div>
    );
  }

  it('starts with isHidden = false', () => {
    render(<TestHarness />);
    expect(screen.getByTestId('hidden-value')).toHaveTextContent('false');
  });

  it('sets isHidden = true on visibilitychange to hidden', () => {
    render(<TestHarness />);

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(screen.getByTestId('hidden-value')).toHaveTextContent('true');
  });

  it('toggles isHidden on visibilitychange visible/hidden', () => {
    render(<TestHarness />);

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByTestId('hidden-value')).toHaveTextContent('true');

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByTestId('hidden-value')).toHaveTextContent('false');
  });

  it('sets isHidden = true on window blur event', () => {
    render(<TestHarness />);

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(screen.getByTestId('hidden-value')).toHaveTextContent('true');
  });

  it('clears isHidden on window focus event', () => {
    render(<TestHarness />);

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(screen.getByTestId('hidden-value')).toHaveTextContent('true');

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(screen.getByTestId('hidden-value')).toHaveTextContent('false');
  });

  it('PrivacyBlurOverlay becomes visible when isHidden is true', () => {
    render(<TestHarness />);

    expect(
      screen.queryByText('تم إخفاء المحتوى مؤقتًا لحمايته'),
    ).not.toBeInTheDocument();

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(
      screen.getByText('تم إخفاء المحتوى مؤقتًا لحمايته'),
    ).toBeInTheDocument();
  });
});

// ── 10. Toast rate-limiting ──

describe('toast rate-limiting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('dispatches toast on first block, rate-limits duplicate within 3s, and allows again after 3s', () => {
    const { container } = render(
      <ProtectedContent policy={{ disableCopy: true }}>
        <p>text</p>
      </ProtectedContent>,
    );
    const el = getProtectedContainer(container);

    const fireCopy = () => {
      const event = new Event('copy', { bubbles: true, cancelable: true });
      el.dispatchEvent(event);
    };

    fireCopy();
    expect(mockDispatch).toHaveBeenCalledTimes(1);

    fireCopy();
    expect(mockDispatch).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(3001);
    fireCopy();
    expect(mockDispatch).toHaveBeenCalledTimes(2);
  });

  it('dispatches toast for each distinct action even when fired together', () => {
    const { container } = render(
      <ProtectedContent policy={{ disableCopy: true, disableCut: true }}>
        <p>text</p>
      </ProtectedContent>,
    );
    const el = getProtectedContainer(container);

    el.dispatchEvent(new Event('copy', { bubbles: true, cancelable: true }));
    expect(mockDispatch).toHaveBeenCalledTimes(1);

    el.dispatchEvent(new Event('cut', { bubbles: true, cancelable: true }));
    expect(mockDispatch).toHaveBeenCalledTimes(2);
  });
});
