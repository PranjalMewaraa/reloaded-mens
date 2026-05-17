import { Controller, Get } from '@nestjs/common';
import { prisma } from '@repo/db';

@Controller('health')
export class HealthController {
  @Get()
  async check() {
    const dbStartedAt = Date.now();
    let dbOk = false;
    let dbError: string | undefined;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch (err) {
      dbError = err instanceof Error ? err.message : String(err);
    }
    const dbLatencyMs = Date.now() - dbStartedAt;

    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: { ok: dbOk, latencyMs: dbLatencyMs, error: dbError },
      },
    };
  }
}
