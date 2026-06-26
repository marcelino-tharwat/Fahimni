import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Static guards (node env, no jsdom — matching the repo's testing convention)
 * proving the production "My Courses" surfaces depend on the real backend hook
 * and never import mock content. These fail loudly if anyone reintroduces
 * `shared/mocks/content` into this flow.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

const page = read('./MyCoursesPage.tsx');
const tab = read('../components/MyCoursesTab.tsx');
const content = read('../components/MyCoursesContent.tsx');

describe('My Courses production surfaces — no mock data', () => {
  it('MyCoursesPage does not import any shared mock module', () => {
    expect(page).not.toMatch(/shared\/mocks/);
    expect(page).not.toMatch(/mockChapters|mockLessons/);
  });

  it('MyCoursesPage renders the real shared MyCoursesContent surface', () => {
    expect(page).toContain('MyCoursesContent');
  });

  it('MyCoursesTab delegates to MyCoursesContent (no mock import)', () => {
    expect(tab).not.toMatch(/shared\/mocks/);
    expect(tab).toContain('MyCoursesContent');
  });

  it('MyCoursesContent sources data from the real useMyCourses hook only', () => {
    expect(content).not.toMatch(/shared\/mocks/);
    expect(content).toContain('useMyCourses');
  });

  it('MyCoursesContent resolves Continue via the real-id helper, not the legacy page', () => {
    expect(content).toContain('courseContinueDestination');
    // The course CTA must not navigate back to the legacy /student/courses page.
    expect(content).not.toMatch(/navigate\(['"]\/student\/courses['"]\)/);
  });
});
