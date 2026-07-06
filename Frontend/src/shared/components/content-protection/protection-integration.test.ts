import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const featuresDir = resolve(here, '../../..');

const read = (...pathSegments: string[]) =>
  readFileSync(resolve(here, ...pathSegments), 'utf8');

function collectFiles(dir: string): string[] {
  const result: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules') result.push(...collectFiles(p));
      } else if (e.isFile() && (e.name.endsWith('.tsx') || e.name.endsWith('.ts'))) {
        result.push(p);
      }
    }
  } catch {
    /* directory may not exist — skip */
  }
  return result;
}

const teacherDir = resolve(featuresDir, 'features/teacher');
const adminDir = resolve(featuresDir, 'features/admin');
const teacherFiles = collectFiles(teacherDir);
const adminFiles = collectFiles(adminDir);

// ── Shared hook/component source checks ──

describe('useContentProtection hook', () => {
  const src = read('./useContentProtection.ts');

  it('registers copy, cut, paste, contextmenu event listeners', () => {
    expect(src).toContain("addEventListener('copy'");
    expect(src).toContain("addEventListener('cut'");
    expect(src).toContain("addEventListener('paste'");
    expect(src).toContain("addEventListener('contextmenu'");
  });

  it('registers selectstart, dragstart, keydown event listeners', () => {
    expect(src).toContain("addEventListener('selectstart'");
    expect(src).toContain("addEventListener('dragstart'");
    expect(src).toContain("addEventListener('keydown'");
  });

  it('blocks Ctrl/Cmd+C and Ctrl/Cmd+P via keyboard handler', () => {
    expect(src).toMatch(/key === 'c'/);
    expect(src).toMatch(/key === 'p'/);
  });

  it('registers beforeprint and afterprint listeners for print protection', () => {
    expect(src).toContain("addEventListener('beforeprint'");
    expect(src).toContain("addEventListener('afterprint'");
  });

  it('cleans up all event listeners on component unmount', () => {
    expect(src).toContain("removeEventListener('copy'");
    expect(src).toContain("removeEventListener('cut'");
    expect(src).toContain("removeEventListener('paste'");
    expect(src).toContain("removeEventListener('contextmenu'");
    expect(src).toContain("removeEventListener('selectstart'");
    expect(src).toContain("removeEventListener('dragstart'");
    expect(src).toContain("removeEventListener('keydown'");
    expect(src).toContain("removeEventListener('beforeprint'");
    expect(src).toContain("removeEventListener('afterprint'");
  });
});

describe('useTabVisibilityBlur hook', () => {
  const src = read('./useTabVisibilityBlur.ts');

  it('listens for visibilitychange, window blur, and window focus', () => {
    expect(src).toContain("visibilitychange");
    expect(src).toContain("window.addEventListener('blur'");
    expect(src).toContain("window.addEventListener('focus'");
  });

  it('sets state to hidden when visibilityState === hidden', () => {
    expect(src).toContain("setIsHidden(document.visibilityState === 'hidden')");
  });

  it('cleans up all listeners on unmount', () => {
    expect(src).toContain("removeEventListener('visibilitychange'");
    expect(src).toContain("removeEventListener('blur'");
    expect(src).toContain("removeEventListener('focus'");
  });
});

describe('ProtectedContent component', () => {
  const src = read('./ProtectedContent.tsx');

  it('wraps children with useContentProtection hook', () => {
    expect(src).toContain('useContentProtection');
  });

  it('renders PrivacyBlurOverlay when policy.blurOnHidden is true', () => {
    expect(src).toContain('{policy.blurOnHidden && <PrivacyBlurOverlay />}');
  });
});

// ── Page-level integration checks ──

describe('QuizPage content protection', () => {
  const src = read('../../../features/student/pages/QuizPage.tsx');

  it('imports ProtectedContent', () => {
    expect(src).toContain("import { ProtectedContent }");
  });

  it('uses policy: disableCopy, disableCut, disablePaste, disableContextMenu, disablePrint, blurOnHidden', () => {
    expect(src).toContain("disableCopy: true");
    expect(src).toContain("disableCut: true");
    expect(src).toContain("disablePaste: true");
    expect(src).toContain("disableContextMenu: true");
    expect(src).toContain("disablePrint: true");
    expect(src).toContain("blurOnHidden: true");
  });

  it('does NOT set disableSelection (keeps text editable in inputs)', () => {
    expect(src).not.toMatch(/disableSelection:\s*true/);
  });
});

describe('QuizResultsPage content protection', () => {
  const src = read('../../../features/student/pages/QuizResultsPage.tsx');

  it('imports ProtectedContent', () => {
    expect(src).toContain("import { ProtectedContent }");
  });

  it('uses policy: disableCopy, disableContextMenu, disablePrint, disableSelection', () => {
    expect(src).toContain("disableCopy: true");
    expect(src).toContain("disableContextMenu: true");
    expect(src).toContain("disablePrint: true");
    expect(src).toContain("disableSelection: true");
  });
});

describe('LessonPage content protection', () => {
  const src = read('../../../features/student/pages/LessonPage.tsx');

  it('imports ProtectedContent', () => {
    expect(src).toContain("import { ProtectedContent }");
  });

  it('uses policy: disableCopy, disableContextMenu, disablePrint, disableSelection', () => {
    expect(src).toContain("disableCopy: true");
    expect(src).toContain("disableContextMenu: true");
    expect(src).toContain("disablePrint: true");
    expect(src).toContain("disableSelection: true");
  });

  it('adds contextmenu handler to YouTube iframe container', () => {
    expect(src).toContain("onContextMenu={(e) => e.preventDefault()}");
  });
});

describe('LessonMaterialsSection content protection', () => {
  const src = read('../../../features/student/components/LessonMaterialsSection.tsx');

  it('imports PdfProtectedViewer', () => {
    expect(src).toContain("import { PdfProtectedViewer }");
  });

  it('no longer imports previewLessonMaterial', () => {
    expect(src).not.toContain("previewLessonMaterial");
  });
});

// ── Global CSS print fallback ──

describe('Global CSS print protection fallback', () => {
  const src = read('../../../styles/globals.css');

  it('contains @media print rule with .print-protected selector', () => {
    expect(src).toContain("@media print");
    expect(src).toMatch(/\.print-protected\s*\{/);
  });
});

// ── Teacher/admin regression ──

describe('Teacher pages have zero content-protection component usage', () => {
  for (const file of teacherFiles) {
    const rel = relative(featuresDir, file);
    it(`${rel} does not import protection components`, () => {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toContain('ProtectedContent');
      expect(content).not.toContain('useContentProtection');
      expect(content).not.toContain('PdfProtectedViewer');
    });
  }
});

describe('Admin pages have zero content-protection component usage', () => {
  for (const file of adminFiles) {
    const rel = relative(featuresDir, file);
    it(`${rel} does not import protection components`, () => {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toContain('ProtectedContent');
      expect(content).not.toContain('useContentProtection');
      expect(content).not.toContain('PdfProtectedViewer');
    });
  }
});
