import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import type { Request } from 'express';

// Global exception filter that logs every caught exception with HTTP context
// before delegating to Nest's default handler. Mounted via APP_FILTER in
// AppModule.providers, so it sees errors from every controller — including
// order placement (POST /public/orders), admin order transitions (PATCH
// /orders/:id/transition), refund flows, etc.
//
// Logging policy:
//   - 5xx / non-HttpException  → error + stack trace (real bugs, need eyes on)
//   - 409 (Conflict)           → warn (expected business-rule rejection; we
//                                 want visibility but it's not a bug)
//   - other 4xx                → warn without stack (validation, auth, etc)
//   - 404                      → silent (crawlers, favicons, stale links —
//                                 too noisy to log every one)
//
// Format goal: one-line entries with structured-ish context so they grep
// cleanly in `docker compose logs api`. Example:
//   [ExceptionsFilter] WARN POST /api/v1/public/orders ← 409 ip=49.34.x user=- Coupon usage limit reached
//
// Response shape is unchanged — we delegate to BaseExceptionFilter so
// clients see the same payload they always did.
@Catch()
export class ExceptionsLoggerFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  constructor(adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request | undefined>();

    const status = exception instanceof HttpException ? exception.getStatus() : 500;

    // Silently delegate 404s — they're routinely hit by crawlers, missing
    // favicons, and stale links, and add no operator signal.
    if (status !== 404) {
      const method = req?.method ?? 'UNKNOWN';
      const url = req?.originalUrl ?? req?.url ?? '?';
      const ip =
        (req?.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
        req?.ip ??
        '?';
      const userId =
        (req as { user?: { id?: string } } | undefined)?.user?.id ??
        (req as { customer?: { id?: string } } | undefined)?.customer?.id ??
        '-';

      const detail = describeException(exception);
      const prefix = `${method} ${url} ← ${status} ip=${ip} user=${userId}`;

      if (status >= 500 || !(exception instanceof HttpException)) {
        // Real bug — capture the stack so we can debug from logs alone.
        this.logger.error(
          `${prefix} ${detail}`,
          exception instanceof Error ? exception.stack : String(exception),
        );
      } else {
        // 4xx — log without stack. Includes 409 Conflict (expected business
        // rejections like out-of-stock or coupon limit reached) which we DO
        // want visibility on for ops review.
        this.logger.warn(`${prefix} ${detail}`);
      }
    }

    super.catch(exception, host);
  }
}

// Pull the human-readable message out of whatever exception shape we got.
// HttpException.getResponse() returns either a string or an object —
// validation errors put their messages on `message: string[]`.
function describeException(exception: unknown): string {
  if (exception instanceof HttpException) {
    const resp = exception.getResponse();
    if (typeof resp === 'string') return resp;
    if (resp && typeof resp === 'object') {
      const r = resp as { message?: string | string[]; reason?: string };
      if (Array.isArray(r.message)) return r.message.join('; ');
      return r.message ?? r.reason ?? exception.message;
    }
    return exception.message;
  }
  if (exception instanceof Error) return exception.message;
  return String(exception);
}
