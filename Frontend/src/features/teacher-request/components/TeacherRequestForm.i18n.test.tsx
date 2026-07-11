// @vitest-environment jsdom
// Real i18n (no react-i18next mock) — this exercises the actual translation
// resource files, catching regressions like the schema referencing a
// namespace/key path that doesn't exist (which would render the raw key or
// nothing, in either language).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import i18n from '@/shared/lib/i18n';
import { TeacherRequestForm } from './TeacherRequestForm';

vi.mock('@/features/subjects/useSubjects', () => ({
  useSubjects: () => ({ subjects: [], loading: false }),
}));

beforeEach(async () => {
  await i18n.changeLanguage('ar');
});
afterEach(() => cleanup());

describe('TeacherRequestForm — validation messages resolve to real translations (not raw i18n keys)', () => {
  it('3. Arabic UI: an empty full name shows the real Arabic validation message', async () => {
    await i18n.changeLanguage('ar');
    render(<TeacherRequestForm />);
    fireEvent.click(screen.getByText('إرسال الطلب'));

    const message = await screen.findByText('الاسم يجب أن يكون حرفين على الأقل');
    expect(message).toBeInTheDocument();
    // The historical bug rendered the literal broken key instead of real text.
    expect(screen.queryByText('validation:fullNameMin')).not.toBeInTheDocument();
  });

  it('4. English UI: an empty full name shows the real English validation message', async () => {
    await i18n.changeLanguage('en');
    render(<TeacherRequestForm />);
    fireEvent.click(screen.getByText('Submit Application'));

    const message = await screen.findByText('Full name must be at least 2 characters');
    expect(message).toBeInTheDocument();
    expect(screen.queryByText('validation:fullNameMin')).not.toBeInTheDocument();
  });
});
