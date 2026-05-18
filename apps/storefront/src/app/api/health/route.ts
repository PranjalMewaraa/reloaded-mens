// Sprint 9 deploy — health endpoint hit by the Docker healthcheck + Caddy /
// Cloudflare uptime probes. Pure stat read, no DB hops — the storefront is
// a stateless render layer. If we ever need a deeper signal (API
// reachability, image CDN latency), add it here.

import { NextResponse } from 'next/server';

// Disable caching so the orchestrator always gets a fresh probe.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
