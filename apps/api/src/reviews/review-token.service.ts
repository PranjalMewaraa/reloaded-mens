import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Per-OrderItem review token. HMAC over `${orderItemId}.${customerId ?? orderId}`
// so the link in a review-invite email is meaningless without the matching
// orderItem id. Mirrors TrackingTokenService — same secret rotation story.
@Injectable()
export class ReviewTokenService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.get<string>('REVIEW_TOKEN_SECRET') ?? 'dev-review-secret';
  }

  sign(orderItemId: string, customerOrOrderId: string): string {
    return createHmac('sha256', this.secret)
      .update(`${orderItemId}.${customerOrOrderId}`)
      .digest('hex');
  }

  verify(expected: string, provided: string): boolean {
    if (typeof provided !== 'string' || provided.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      return false;
    }
  }
}
