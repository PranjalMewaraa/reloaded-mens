import type { OrderSnapshot } from '@repo/types';

export interface OtpEmailInput {
  to: string;
  code: string;
  ttlMinutes: number;
}

export interface ReviewInviteItem {
  orderItemId: string;
  productName: string;
  productSlug: string;
  variantLabel: string | null;
  reviewUrl: string;
}

export interface ReviewInviteEmailInput {
  to: string;
  customerName: string;
  orderNumber: string;
  items: ReviewInviteItem[];
}

// Sprint 4 — only one template shipped (order confirmation). Sprint 5+ added shipped,
// delivered, refund etc. Sprint 8 adds OTP + review-invite. Discrete methods rather
// than a single sendTemplated(name, vars) so the type checker catches drift between
// the call site and the React Email template.
export interface EmailService {
  sendOrderConfirmation(input: { to: string; order: OrderSnapshot }): Promise<void>;
  sendOtpEmail(input: OtpEmailInput): Promise<void>;
  sendReviewInvite(input: ReviewInviteEmailInput): Promise<void>;
}

export const EMAIL_SERVICE = 'EMAIL_SERVICE';
