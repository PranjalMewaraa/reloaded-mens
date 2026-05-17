import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Deterministic per-order token. Stable for the order's lifetime so the same email
// link keeps working across re-renders. Rotating TRACKING_TOKEN_SECRET breaks all
// existing tracking links — explicit Sprint-9+ hardening if a leak happens.
@Injectable()
export class TrackingTokenService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    // Default keeps dev frictionless. Production should always set
    // TRACKING_TOKEN_SECRET to a randomly generated 32-byte hex string.
    this.secret = config.get<string>('TRACKING_TOKEN_SECRET') ?? 'dev-tracking-secret';
  }

  /**
   * Compute the canonical token for an order. The phone is included so a leaked
   * orderNumber alone isn't enough to access the tracking page — at minimum an
   * attacker would also need a leaked URL.
   */
  sign(orderId: string, phone: string): string {
    return createHmac('sha256', this.secret).update(`${orderId}.${phone}`).digest('hex');
  }

  /**
   * Constant-time comparison so a token check can't be turned into an oracle.
   */
  verify(expected: string, provided: string): boolean {
    if (typeof provided !== 'string' || provided.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      return false;
    }
  }
}
