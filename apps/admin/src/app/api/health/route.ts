// Sprint 9 deploy — health endpoint hit by the Docker healthcheck + Caddy
// uptime probes. Pure stat read; the admin app reads Prisma directly in some
// Server Components but the health route deliberately doesn't, so a brief
// DB blip won't take the container down.

import { NextResponse } from 'next/server';

// Disable caching so the orchestrator always gets a fresh probe.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
