import { env } from "../../config/env.js";
import { AppError } from "../../shared/utils/AppError.js";

const PAYMOB_BASE_URL = "https://accept-alpha.paymob.com";

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
  async authenticate(): Promise<string> {
    const response = await fetch(
      `${PAYMOB_BASE_URL}/api/auth/tokens`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: env.PAYMOB_API_KEY }),
      },
    );

    if (!response.ok) {
      throw new AppError("Paymob authentication failed", 502);
    }

    const data = (await response.json()) as { token: string };
    return data.token;
  }

  async createOrder(token: string, amountEGP: number): Promise<string> {
    const amountCents = Math.round(amountEGP * 100);

    const response = await fetch(
      `${PAYMOB_BASE_URL}/api/ecommerce/orders`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount_cents: amountCents,
          currency: "EGP",
          items: [],
        }),
      },
    );

    if (!response.ok) {
      throw new AppError("Failed to create Paymob order", 502);
    }

    const data = (await response.json()) as { id: number };
    return String(data.id);
  }

  async getPaymentKey(
    token: string,
    paymobOrderId: string,
    amountEGP: number,
    billingData: BillingData,
  ): Promise<string> {
    const amountCents = Math.round(amountEGP * 100);

    const response = await fetch(
      `${PAYMOB_BASE_URL}/api/acceptance/payment_keys`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_token: token,
          amount_cents: amountCents,
          expiration: 3600,
          order_id: paymobOrderId,
          integration_id: env.PAYMOB_INTEGRATION_ID,
          billing_data: billingData,
        }),
      },
    );

    if (!response.ok) {
      throw new AppError("Failed to get Paymob payment key", 502);
    }

    const data = (await response.json()) as { token: string };
    return data.token;
  }

  buildIframeUrl(paymentKey: string): string {
    return `${PAYMOB_BASE_URL}/api/acceptance/iframes/${env.PAYMOB_IFRAME_ID}?payment_token=${paymentKey}`;
  }
}
