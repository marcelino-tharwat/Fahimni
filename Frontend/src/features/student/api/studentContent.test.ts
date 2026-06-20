import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared API client so these are pure unit tests (no network, no auth).
const mockGet = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/api/client', () => ({ apiClient: { get: mockGet } }));

import { studentContentApi } from './studentContent';
import {
  STUDENT_TREE_KEY,
  STUDENT_MY_COURSES_KEY,
} from '@/features/student/hooks/useStudentContent';

describe('studentContentApi', () => {
  beforeEach(() => mockGet.mockReset());

  it('getTree() reads the raw array from /content/student/tree', async () => {
    mockGet.mockResolvedValue({ data: [{ stage: { id: 's1' }, chapters: [] }] });
    const res = await studentContentApi.getTree();
    expect(mockGet).toHaveBeenCalledWith('/content/student/tree');
    expect(res).toHaveLength(1);
  });

  it('getTree() returns [] for a non-array payload (no fallback to other data)', async () => {
    mockGet.mockResolvedValue({ data: { message: 'diagnostics' } });
    expect(await studentContentApi.getTree()).toEqual([]);
  });

  it('getMyCourses() unwraps the { data } envelope from its own endpoint', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: [{ id: 'c1' }] } });
    const res = await studentContentApi.getMyCourses();
    expect(mockGet).toHaveBeenCalledWith('/content/student/my-courses');
    expect(res).toEqual([{ id: 'c1' }]);
  });

  it('getMyCourses() returns [] for an empty/missing envelope (drives the empty state)', async () => {
    mockGet.mockResolvedValue({ data: { success: true } });
    expect(await studentContentApi.getMyCourses()).toEqual([]);
  });

  it('My Courses never sources data from the tree endpoint', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: [] } });
    await studentContentApi.getMyCourses();
    expect(mockGet).toHaveBeenCalledWith('/content/student/my-courses');
    expect(mockGet).not.toHaveBeenCalledWith('/content/student/tree');
  });

  it('tree and my-courses use separate query keys (no cache collision)', () => {
    expect(JSON.stringify(STUDENT_TREE_KEY)).not.toBe(JSON.stringify(STUDENT_MY_COURSES_KEY));
  });
});
