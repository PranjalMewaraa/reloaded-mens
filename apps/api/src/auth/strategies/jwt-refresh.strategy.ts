import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy, type StrategyOptionsWithRequest } from 'passport-jwt';
import { prisma } from '@repo/db';
import { REFRESH_COOKIE, type JwtRefreshPayload } from '../auth.service.js';

function cookieExtractor(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[REFRESH_COOKIE] ?? null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) throw new Error('Missing JWT_REFRESH_SECRET');
    const options: StrategyOptionsWithRequest = {
      jwtFromRequest: cookieExtractor,
      secretOrKey: secret,
      passReqToCallback: true,
      ignoreExpiration: false,
    };
    super(options);
  }

  async validate(_req: Request, payload: JwtRefreshPayload) {
    if (payload.type !== 'refresh') throw new UnauthorizedException();
    const user = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException();
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
