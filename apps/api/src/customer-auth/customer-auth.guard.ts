import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { prisma } from '@repo/db';
import type { Request } from 'express';
import { CUSTOMER_ACCESS_COOKIE, CustomerAuthService } from './customer-auth.service.js';

// Standalone guard (not extending AuthGuard) because customer auth has its own
// secret + cookie name. Attaches req.customer = { id, phone, email } on success.
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(private readonly auth: CustomerAuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { cookies?: Record<string, string>; customer?: { id: string; phone: string; email: string | null } }>();
    const token = req.cookies?.[CUSTOMER_ACCESS_COOKIE];
    if (!token) throw new UnauthorizedException();
    let payload;
    try {
      payload = this.auth.verifyAccess(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.type !== 'customer_access') throw new UnauthorizedException();
    const customer = await prisma.customer.findUnique({
      where: { id: payload.sub },
      select: { id: true, phone: true, email: true, deletedAt: true },
    });
    if (!customer || customer.deletedAt) throw new UnauthorizedException();
    req.customer = { id: customer.id, phone: customer.phone, email: customer.email };
    return true;
  }
}
