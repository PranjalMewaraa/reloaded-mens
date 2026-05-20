import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy, type StrategyOptionsWithRequest } from 'passport-jwt';
import { prisma } from '@repo/db';
import { ACCESS_COOKIE, type JwtAccessPayload } from '../auth.service.js';

function cookieExtractor(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[ACCESS_COOKIE] ?? null;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) throw new Error('Missing JWT_ACCESS_SECRET');
    const options: StrategyOptionsWithRequest = {
      jwtFromRequest: cookieExtractor,
      secretOrKey: secret,
      passReqToCallback: true,
      ignoreExpiration: false,
    };
    super(options);
  }

  async validate(_req: Request, payload: JwtAccessPayload) {
    if (payload.type !== 'access') throw new UnauthorizedException();
    const user = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException();
    // permissions ride on req.user so ModuleGuard doesn't need a second DB
    // hit per request. Stored as Json in the DB; cast to string[] here —
    // ModuleGuard further validates against STAFF_MODULES in @repo/types.
    const permissions = Array.isArray(user.permissions) ? (user.permissions as string[]) : [];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions,
    };
  }
}
