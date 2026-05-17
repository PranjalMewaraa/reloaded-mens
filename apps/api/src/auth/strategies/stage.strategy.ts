import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy, type StrategyOptionsWithRequest } from 'passport-jwt';
import { prisma } from '@repo/db';
import { STAGE_COOKIE, type JwtStagePayload } from '../auth.service.js';

function cookieExtractor(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[STAGE_COOKIE] ?? null;
}

// Stage strategy returns the JWT payload (with the step) plus the loaded user,
// so controllers can branch on which step the client is allowed to perform.
@Injectable()
export class StageStrategy extends PassportStrategy(Strategy, 'stage') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_STAGE_SECRET');
    if (!secret) throw new Error('Missing JWT_STAGE_SECRET');
    const options: StrategyOptionsWithRequest = {
      jwtFromRequest: cookieExtractor,
      secretOrKey: secret,
      passReqToCallback: true,
      ignoreExpiration: false,
    };
    super(options);
  }

  async validate(_req: Request, payload: JwtStagePayload) {
    if (payload.step !== 'totp' && payload.step !== 'totp_enroll') {
      throw new UnauthorizedException();
    }
    const user = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      step: payload.step,
    };
  }
}
