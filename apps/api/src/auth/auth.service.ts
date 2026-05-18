import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { prisma } from '@repo/db';
import bcrypt from 'bcryptjs';
import type { Response } from 'express';

export type TokenType = 'access' | 'refresh';
export type StageStep = 'totp' | 'totp_enroll';

export interface JwtAccessPayload {
  sub: string;
  type: 'access';
}

export interface JwtRefreshPayload {
  sub: string;
  type: 'refresh';
}

export interface JwtStagePayload {
  sub: string;
  step: StageStep;
}

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const STAGE_COOKIE = 'stage_token';

export const COOKIE_PATHS = {
  access: '/',
  refresh: '/api/v1/auth/refresh',
  stage: '/api/v1/auth',
} as const;

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly stageSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;
  private readonly stageTtl: string;
  private readonly isProd: boolean;
  // When set, the cookie is issued with Domain=<value> so it's valid across
  // every subdomain of the registrable domain. In production we set this to
  // `.reloadedmens.in` so the same auth cookie reaches reloadedmens.in,
  // admin.reloadedmens.in, AND api.reloadedmens.in — otherwise the admin's
  // client-side fetches to api.* would arrive without a cookie (host-only
  // cookies are scoped to the issuing host). Left undefined locally so dev
  // cookies stay host-only on localhost.
  private readonly cookieDomain: string | undefined;
  // When false, /auth/login short-circuits the TOTP step and issues a session immediately.
  // Defaults to true (secure-by-default). MVP local/dev sets this to false in .env.
  readonly totpRequired: boolean;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessSecret = required(config, 'JWT_ACCESS_SECRET');
    this.refreshSecret = required(config, 'JWT_REFRESH_SECRET');
    this.stageSecret = required(config, 'JWT_STAGE_SECRET');
    this.accessTtl = config.get<string>('JWT_ACCESS_TTL') ?? '15m';
    this.refreshTtl = config.get<string>('JWT_REFRESH_TTL') ?? '30d';
    this.stageTtl = config.get<string>('JWT_STAGE_TTL') ?? '5m';
    this.isProd = (config.get<string>('NODE_ENV') ?? 'development') === 'production';
    this.cookieDomain = config.get<string>('COOKIE_DOMAIN') || undefined;
    this.totpRequired = parseBool(config.get<string>('ADMIN_TOTP_REQUIRED'), true);
  }

  // Returns the AdminUser if credentials valid and the account is active, else null.
  async verifyPassword(email: string, password: string) {
    const user = await prisma.adminUser.findUnique({ where: { email } });
    if (!user || !user.isActive) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }

  signAccess(userId: string): string {
    const payload: JwtAccessPayload = { sub: userId, type: 'access' };
    return this.jwt.sign(payload, { secret: this.accessSecret, expiresIn: this.accessTtl });
  }

  signRefresh(userId: string): string {
    const payload: JwtRefreshPayload = { sub: userId, type: 'refresh' };
    return this.jwt.sign(payload, { secret: this.refreshSecret, expiresIn: this.refreshTtl });
  }

  signStage(userId: string, step: StageStep): string {
    const payload: JwtStagePayload = { sub: userId, step };
    return this.jwt.sign(payload, { secret: this.stageSecret, expiresIn: this.stageTtl });
  }

  verifyAccess(token: string): JwtAccessPayload {
    return this.jwt.verify<JwtAccessPayload>(token, { secret: this.accessSecret });
  }

  verifyRefresh(token: string): JwtRefreshPayload {
    return this.jwt.verify<JwtRefreshPayload>(token, { secret: this.refreshSecret });
  }

  verifyStage(token: string): JwtStagePayload {
    return this.jwt.verify<JwtStagePayload>(token, { secret: this.stageSecret });
  }

  // Sets the long-lived session cookies for an authenticated admin.
  issueSession(res: Response, userId: string) {
    const access = this.signAccess(userId);
    const refresh = this.signRefresh(userId);

    res.cookie(ACCESS_COOKIE, access, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProd,
      domain: this.cookieDomain,
      path: COOKIE_PATHS.access,
      maxAge: durationToMs(this.accessTtl),
    });
    res.cookie(REFRESH_COOKIE, refresh, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProd,
      domain: this.cookieDomain,
      path: COOKIE_PATHS.refresh,
      maxAge: durationToMs(this.refreshTtl),
    });
  }

  issueStage(res: Response, userId: string, step: StageStep) {
    const token = this.signStage(userId, step);
    res.cookie(STAGE_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProd,
      domain: this.cookieDomain,
      path: COOKIE_PATHS.stage,
      maxAge: durationToMs(this.stageTtl),
    });
  }

  reissueAccess(res: Response, userId: string) {
    const access = this.signAccess(userId);
    res.cookie(ACCESS_COOKIE, access, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProd,
      domain: this.cookieDomain,
      path: COOKIE_PATHS.access,
      maxAge: durationToMs(this.accessTtl),
    });
  }

  // clearCookie must include the same domain/path the cookie was issued with —
  // otherwise the browser keeps the original cookie alive.
  clearSession(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { path: COOKIE_PATHS.access, domain: this.cookieDomain });
    res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATHS.refresh, domain: this.cookieDomain });
    res.clearCookie(STAGE_COOKIE, { path: COOKIE_PATHS.stage, domain: this.cookieDomain });
  }

  clearStage(res: Response) {
    res.clearCookie(STAGE_COOKIE, { path: COOKIE_PATHS.stage, domain: this.cookieDomain });
  }

  async loadActiveUser(userId: string) {
    const user = await prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new UnauthorizedException();
    return user;
  }
}

function required(config: ConfigService, key: string): string {
  const v = config.get<string>(key);
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  const v = value.toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return fallback;
}

// Converts strings like "15m" / "30d" / "5m" into milliseconds for cookie Max-Age.
// Accepts a subset of jsonwebtoken's vocabulary: s, m, h, d. Numeric input is treated as seconds.
function durationToMs(value: string): number {
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const n = Number(match[1]);
  const unit = match[2];
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return n * mult;
}
