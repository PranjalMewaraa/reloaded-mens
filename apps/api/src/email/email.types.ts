import type { OrderSnapshot } from '@repo/types';

// Sprint 4 — only one template ships (order confirmation). Sprint 5+ will add shipped,
// delivered, refund etc. Adding `sendXxx` methods here is intentional rather than a
// single `sendTemplated(name, vars)` so the type checker catches drift between code and
// templates.
export interface EmailService {
  sendOrderConfirmation(input: { to: string; order: OrderSnapshot }): Promise<void>;
}

export const EMAIL_SERVICE = 'EMAIL_SERVICE';
