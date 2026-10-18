import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Guards all /pos/* endpoints. The billing app sends its shared API token
 * in the Authorization: Bearer <token> header. Token is set via the
 * BILLING_API_TOKEN environment variable. If the env var is empty the
 * guard rejects every request — misconfiguration surfaces immediately.
 */
@Injectable()
export class PosAuthGuard implements CanActivate {
  private readonly token: string | undefined;

  constructor(config: ConfigService) {
    this.token = config.get<string>('BILLING_API_TOKEN')?.trim() || undefined;
  }

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.token) {
      throw new UnauthorizedException('POS is not configured (BILLING_API_TOKEN missing)');
    }

    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers['authorization'];

    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing POS authorization token');
    }

    const provided = auth.slice(7).trim();
    if (provided !== this.token) {
      throw new UnauthorizedException('Invalid POS authorization token');
    }

    return true;
  }
}
