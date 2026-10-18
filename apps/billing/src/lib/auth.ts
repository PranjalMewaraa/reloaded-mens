import { createHmac } from 'crypto';

export const SESSION_COOKIE = 'billing_session';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

function getSecret(): string {
  const secret = process.env.BILLING_SESSION_SECRET;
  if (!secret) throw new Error('BILLING_SESSION_SECRET is not set');
  return secret;
}

function hmac(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Creates a signed cookie value: `email:timestamp:signature`
 */
export function signSession(email: string): string {
  const timestamp = Date.now().toString();
  const secret = getSecret();
  const payload = `${email}:${timestamp}`;
  const sig = hmac(payload, secret);
  return `${payload}:${sig}`;
}

/**
 * Verifies a signed cookie value. Returns the email on success or null on failure.
 */
export function verifySession(cookieValue: string): string | null {
  try {
    const parts = cookieValue.split(':');
    // email may contain no colons, so parts.length >= 3
    // format: email:timestamp:sig
    if (parts.length < 3) return null;

    const sig = parts[parts.length - 1];
    const timestamp = parts[parts.length - 2];
    const email = parts.slice(0, parts.length - 2).join(':');

    if (!email || !timestamp || !sig) return null;

    const ts = parseInt(timestamp, 10);
    if (isNaN(ts)) return null;

    // Check timestamp not older than 8 hours
    if (Date.now() - ts > SESSION_MAX_AGE_MS) return null;

    const secret = getSecret();
    const payload = `${email}:${timestamp}`;
    const expectedSig = hmac(payload, secret);

    // Constant-time comparison
    if (sig.length !== expectedSig.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) {
      diff |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    }
    if (diff !== 0) return null;

    return email;
  } catch {
    return null;
  }
}
