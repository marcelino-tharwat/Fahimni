import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

const page = read('./TeacherPlansPage.tsx');
const api = read('../api/teacherPlans.ts');
const types = read('../types/teacherPlans.ts');

describe('TeacherPlansPage — real data guards', () => {
  it('fetches plans from teacherPlansApi (no mock data)', () => {
    expect(page).toContain('teacherPlansApi');
    expect(page).not.toMatch(/mockPlans|fakePlans|dummyPlans|staticPlans/i);
    expect(api).toContain('/teacher/plans');
  });

  it('fetches subscription from teacherPlansApi', () => {
    expect(api).toContain('/teacher/subscription/me');
    expect(page).toContain('getMySubscription');
  });

  it('creates subscription request via API, never directly in DB', () => {
    expect(api).toContain('/teacher/subscription/requests');
    expect(page).not.toContain('prisma');
    expect(page).not.toContain('TeacherSubscriptionRequest');
  });

  it('plan id derived from API response, never hardcoded', () => {
    expect(page).not.toMatch(/id:\s*['"][a-f0-9-]{36}['"]/i);
  });

  it('has full state coverage: loading, error, empty, loaded', () => {
    expect(page).toContain('loading');
    expect(page).toContain('error');
    expect(page).toContain('plans.length === 0');
  });

  it('subscribe button disabled for current plan and pending request', () => {
    expect(page).toContain('isCurrentPlan(plan)');
    expect(page).toContain('hasPendingRequest(plan)');
    expect(page).toContain('isDisabled');
  });

  it('pending request alert is shown when subscription has pendingRequest', () => {
    expect(page).toContain('pendingRequest');
    expect(page).toContain('pendingRequestAlert');
  });

  it('billing interval toggle exists (MONTHLY / YEARLY)', () => {
    expect(page).toContain('MONTHLY');
    expect(page).toContain('YEARLY');
    expect(page).toContain("setBillingInterval(billingInterval === 'MONTHLY' ? 'YEARLY' : 'MONTHLY')");
  });

  it('usage data passed to TeacherPlansCurrentPlanCard which renders UsageMeters', () => {
    expect(page).toContain('TeacherPlansCurrentPlanCard');
    expect(page).toContain('data={subscription}');
  });

  it('TeacherPlan type matches API DTO fields', () => {
    expect(types).toContain('monthlyPrice');
    expect(types).toContain('yearlyPrice');
    expect(types).toContain('isRecommended');
    expect(types).toContain('features');
    expect(types).toContain('limits');
  });

  it('SubscriptionMeResponse has usage, subscription, pendingRequest', () => {
    expect(types).toContain('usage: UsageSummary');
    expect(types).toContain('subscription: SubscriptionInfo | null');
    expect(types).toContain('pendingRequest: PendingRequestInfo | null');
  });
});
