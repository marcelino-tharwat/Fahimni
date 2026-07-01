import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../shared/utils/AppError.js";

const PAYMOB_TIMEOUT_MS = 30_000;
const TOKEN_TTL_MS = 55 * 60 * 1000;

export interface BillingData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  apartment: "NA";
  floor: "NA";
  street: "NA";
  building: "NA";
  city: "NA";
  country: "NA";
  state: "NA";
  postal_code: "NA";
}

export class PaymobService {
  private cachedToken: { token: string; expiresAt: number } | null = null;

  async getValidToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.token;
    }
    const token = await this.authenticate();
    this.cachedToken = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
    return token;
  }

  private async fetchWithTimeout(
    path: string,
    options: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAYMOB_TIMEOUT_MS);
    try {
      const url = `${env.PAYMOB_BASE_URL}${path}`;
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === "AbortError") {
        logger.error("Paymob request timed out", {
          path,
          timeoutMs: PAYMOB_TIMEOUT_MS,
        });
        throw new AppError("Payment service timed out. Please try again.", 502);
      }
      logger.error("Paymob network error", {
        path,
        errorMessage: error.message,
      });
      throw new AppError("Payment service unavailable. Please try again.", 502);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async handleResponse<T>(
    response: Response,
    path: string,
  ): Promise<T> {
    if (!response.ok) {
      let responseBody: string;
      try {
        responseBody = await response.text();
      } catch {
        responseBody = "(unable to read body)";
      }
      logger.error("Paymob request failed", {
        path,
        status: response.status,
        responseBody,
      });
      throw new AppError("Payment service error. Please try again.", 502);
    }
    return (await response.json()) as T;
  }

  private async authenticate(): Promise<string> {
    const response = await this.fetchWithTimeout("/api/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: env.PAYMOB_API_KEY }),
    });

    const data = await this.handleResponse<{ token: string }>(
      response,
      "/api/auth/tokens",
    );
    return data.token;
  }

  async createOrder(token: string, amountInEGP: number): Promise<string> {
    const amountCents = Math.round(amountInEGP * 100);

    const response = await this.fetchWithTimeout("/api/ecommerce/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount_cents: amountCents,
        currency: env.PAYMOB_CURRENCY,
        items: [],
      }),
    });

    const data = await this.handleResponse<{ id: number }>(
      response,
      "/api/ecommerce/orders",
    );
    return String(data.id);
  }

  async getPaymentKey(
    token: string,
    paymobOrderId: string,
    amountInEGP: number,
    billingData: BillingData,
    chapterId?: string,
  ): Promise<string> {
    const amountCents = Math.round(amountInEGP * 100);

    const redirectionUrl = chapterId
      ? `${env.FRONTEND_BASE_URL}/student/dashboard?orderId=${paymobOrderId}&chapterId=${chapterId}`
      : `${env.FRONTEND_BASE_URL}/student/dashboard?orderId=${paymobOrderId}`;

    const response = await this.fetchWithTimeout(
      "/api/acceptance/payment_keys",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_token: token,
          amount_cents: amountCents,
          expiration: 3600,
          order_id: paymobOrderId,
          currency: env.PAYMOB_CURRENCY,
          integration_id: env.PAYMOB_INTEGRATION_ID,
          billing_data: billingData,
          redirection_url: redirectionUrl,
        }),
      },
    );

    const data = await this.handleResponse<{ token: string }>(
      response,
      "/api/acceptance/payment_keys",
    );
    return data.token;
  }

  buildIframeUrl(paymentKey: string): string {
    return `${env.PAYMOB_BASE_URL}/api/acceptance/iframes/${env.PAYMOB_IFRAME_ID}?payment_token=${paymentKey}`;
  }
}
