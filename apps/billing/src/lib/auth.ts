export const SESSION_COOKIE = 'billing_session';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

function getSecret(): string {
  const secret = process.env.BILLING_SESSION_SECRET;
  if (!secret) throw new Error('BILLING_SESSION_SECRET is not set');
  return secret;
}

// Web Crypto HMAC-SHA256 — works in both Edge runtime and Node.js.
async function hmacHex(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Creates a signed cookie value: `email:timestamp:signature` */
export async function signSession(email: string): Promise<string> {
  const timestamp = Date.now().toString();
  const secret = getSecret();
  const payload = `${email}:${timestamp}`;
  const sig = await hmacHex(payload, secret);
  return `${payload}:${sig}`;
}

/** Verifies a signed cookie value. Returns the email on success or null on failure. */
export async function verifySession(cookieValue: string): Promise<string | null> {
  try {
    const parts = cookieValue.split(':');
    if (parts.length < 3) return null;

    const sig = parts[parts.length - 1];
    const timestamp = parts[parts.length - 2];
    const email = parts.slice(0, parts.length - 2).join(':');

    if (!email || !timestamp || !sig) return null;

    const ts = parseInt(timestamp, 10);
    if (isNaN(ts)) return null;
    if (Date.now() - ts > SESSION_MAX_AGE_MS) return null;

    const secret = getSecret();
    const payload = `${email}:${timestamp}`;
    const expectedSig = await hmacHex(payload, secret);

    // Constant-time comparison
    if (sig.length !== expectedSig.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) {
      diff |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    }
    return diff === 0 ? email : null;
  } catch {
    return null;
  }
}
