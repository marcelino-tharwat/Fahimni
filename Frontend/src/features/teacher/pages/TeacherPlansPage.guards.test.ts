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

describe('TeacherPlansPage — real payment checkout flow', () => {
  it('api exposes a checkout method hitting the checkout endpoint', () => {
    expect(api).toContain('/teacher/subscription/checkout');
    expect(api).toContain('checkout:');
  });

  it('main paid button triggers checkout and redirects to the provider URL', () => {
    expect(page).toContain('handleCheckout');
    expect(page).toContain('teacherPlansApi.checkout');
    expect(page).toContain('window.location.assign');
    // The primary button label is "Pay Now", not a manual request.
    expect(page).toContain("'plans.payNow'");
    expect(page).toContain('onClick={() => handleCheckout(plan.id)}');
  });

  it('does NOT show a fake success on checkout (only redirect)', () => {
    // handleCheckout must never surface a success message from the checkout
    // response — success only comes from a confirmed payment, reflected via
    // subscription state after the redirect. (Resetting to null is allowed.)
    const checkoutFn = page.slice(
      page.indexOf('const handleCheckout'),
      page.indexOf('const handleManualRequest'),
    );
    expect(checkoutFn).not.toContain('setSuccessMsg(result');
    expect(checkoutFn).toContain('window.location.assign');
  });

  it('renders the pending payment and payment-unavailable states', () => {
    expect(page).toContain('pendingPayment');
    expect(page).toContain('paymentPendingAlert');
    expect(page).toContain('paymentUnavailable');
  });

  it('manual admin request is a secondary action, not the main flow', () => {
    expect(page).toContain('handleManualRequest');
    expect(page).toContain('requestManualReview');
    // The main card button calls checkout, not the manual request.
    expect(page).not.toContain('onClick={() => handleManualRequest(plan.id)}\n                disabled={isDisabled');
  });

  it('PendingPaymentInfo type and pendingPayment field exist', () => {
    expect(types).toContain('PendingPaymentInfo');
    expect(types).toContain('pendingPayment: PendingPaymentInfo | null');
    expect(types).toContain('CheckoutResponse');
  });
});
