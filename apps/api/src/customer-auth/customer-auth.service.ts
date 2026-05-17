import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { prisma } from '@repo/db';
import {
  AUDIT_EVENT_TYPE,
  OTP_CHANNEL,
  type CustomerProfile,
  type RequestCustomerOtpResponse,
  type UpdateCustomerProfileRequest,
} from '@repo/types';
import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { EMAIL_SERVICE, type EmailService } from '../email/email.types.js';

// Cookie + JWT shape mirrors the admin auth module — distinct names + secrets so
// a customer access token can never be replayed as an admin token (and vice versa).

export const CUSTOMER_ACCESS_COOKIE = 'customer_access';
export const CUSTOMER_REFRESH_COOKIE = 'customer_refresh';

export const CUSTOMER_COOKIE_PATHS = {
  access: '/',
  refresh: '/api/v1/customer-auth',
} as const;

export interface CustomerAccessPayload {
  sub: string;
  type: 'customer_access';
}

export interface CustomerRefreshPayload {
  sub: string;
  type: 'customer_refresh';
  // Bumped on every login. Refresh fails if the DB row's sessionVersion is
  // ahead of the token — gives us a one-knob "log out everywhere".
  sv: number;
}

interface ActorCtx {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class CustomerAuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;
  private readonly isProd: boolean;
  private readonly otpTtlMinutes: number;
  private readonly otpMaxAttempts: number;
  private readonly devFallbackEmail: string | null;
  // In-memory rate-limit map. Keyed by phone — last-issued timestamp. Sprint 17
  // replaces with Redis when observability lands. Plenty for MVP.
  private readonly recentOtpRequests = new Map<string, number>();
  private readonly otpRequestCooldownMs = 60_000;

  constructor(
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    config: ConfigService,
    @Inject(EMAIL_SERVICE) private readonly email: EmailService,
  ) {
    this.accessSecret = required(config, 'JWT_CUSTOMER_ACCESS_SECRET');
    this.refreshSecret = required(config, 'JWT_CUSTOMER_REFRESH_SECRET');
    this.accessTtl = config.get<string>('JWT_CUSTOMER_ACCESS_TTL') ?? '15m';
    this.refreshTtl = config.get<string>('JWT_CUSTOMER_REFRESH_TTL') ?? '30d';
    this.isProd = (config.get<string>('NODE_ENV') ?? 'development') === 'production';
    this.otpTtlMinutes = numberOr(config.get<string>('CUSTOMER_OTP_TTL_MINUTES'), 10);
    this.otpMaxAttempts = numberOr(config.get<string>('CUSTOMER_OTP_MAX_ATTEMPTS'), 5);
    // Dev-only fallback email — used when the customer's phone has no email on
    // file. Lets devs test the OTP flow without seeding contact data.
    this.devFallbackEmail = config.get<string>('CUSTOMER_OTP_DEV_FALLBACK_EMAIL') ?? null;
  }

  // =====================================================
  // OTP issue
  // =====================================================

  async requestOtp(phone: string, ctx: ActorCtx): Promise<RequestCustomerOtpResponse> {
    const now = Date.now();
    const lastIssued = this.recentOtpRequests.get(phone);
    if (lastIssued && now - lastIssued < this.otpRequestCooldownMs) {
      // Wait it out — never leak the fact that something's pending. Return a
      // successful-looking response so brute-forcers can't probe.
      return {
        ok: true,
        deliveredTo: '',
        channel: OTP_CHANNEL.EMAIL,
        expiresInSeconds: this.otpTtlMinutes * 60,
      };
    }
    this.recentOtpRequests.set(phone, now);

    const existing = await prisma.customer.findUnique({
      where: { phone },
      select: { id: true, email: true },
    });
    const destEmail = existing?.email ?? this.devFallbackEmail;
    if (!destEmail) {
      // No address to send the code to. We log a deliberate audit row so the
      // owner can see the customer tried but had no email. Returning the same
      // shape prevents account-enumeration.
      await this.audit.write(AUDIT_EVENT_TYPE.CUSTOMER_OTP_REQUESTED, {
        ...ctx,
        resource: `customer:phone=${phone}`,
        payload: { delivered: false, reason: 'no_email_on_file' },
      });
      return {
        ok: true,
        deliveredTo: '',
        channel: OTP_CHANNEL.EMAIL,
        expiresInSeconds: this.otpTtlMinutes * 60,
      };
    }

    const code = generateOtpCode();
    const codeHash = await bcrypt.hash(code, 8);
    const expiresAt = new Date(now + this.otpTtlMinutes * 60_000);

    await prisma.customerOtp.create({
      data: {
        phone,
        codeHash,
        channel: OTP_CHANNEL.EMAIL,
        deliveredTo: destEmail,
        expiresAt,
        ipAddress: ctx.ipAddress ?? null,
      },
    });

    // Fire-and-forget — the audit row already captures the request even if email fails.
    void this.email
      .sendOtpEmail({ to: destEmail, code, ttlMinutes: this.otpTtlMinutes })
      .catch(() => {});

    await this.audit.write(AUDIT_EVENT_TYPE.CUSTOMER_OTP_REQUESTED, {
      ...ctx,
      resource: `customer:phone=${phone}`,
      payload: { delivered: true, channel: OTP_CHANNEL.EMAIL, deliveredTo: destEmail },
    });

    return {
      ok: true,
      deliveredTo: maskEmail(destEmail),
      channel: OTP_CHANNEL.EMAIL,
      expiresInSeconds: this.otpTtlMinutes * 60,
    };
  }

  // =====================================================
  // OTP verify
  // =====================================================

  async verifyOtp(
    phone: string,
    code: string,
    ctx: ActorCtx,
    res: Response,
  ): Promise<CustomerProfile> {
    const otp = await prisma.customerOtp.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) {
      await this.audit.write(AUDIT_EVENT_TYPE.CUSTOMER_OTP_FAILED, {
        ...ctx,
        resource: `customer:phone=${phone}`,
        payload: { reason: 'no_pending_otp' },
      });
      throw new UnauthorizedException({ reason: 'invalid_or_expired', message: 'Invalid or expired code' });
    }

    if (otp.attempts >= this.otpMaxAttempts) {
      throw new UnauthorizedException({ reason: 'attempts_exceeded', message: 'Too many attempts — request a new code' });
    }

    const matches = await bcrypt.compare(code, otp.codeHash);
    if (!matches) {
      await prisma.customerOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      await this.audit.write(AUDIT_EVENT_TYPE.CUSTOMER_OTP_FAILED, {
        ...ctx,
        resource: `customer:phone=${phone}`,
        payload: { reason: 'mismatch', attempts: otp.attempts + 1 },
      });
      throw new UnauthorizedException({ reason: 'invalid_or_expired', message: 'Invalid or expired code' });
    }

    // Atomic upsert + session bump so the verification + login state share one round trip.
    const customer = await prisma.$transaction(async (tx) => {
      await tx.customerOtp.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      });
      // Mark every other unconsumed OTP for this phone as consumed too — kills
      // the "request, request, verify the first" race.
      await tx.customerOtp.updateMany({
        where: { phone, consumedAt: null, id: { not: otp.id } },
        data: { consumedAt: new Date() },
      });

      return tx.customer.upsert({
        where: { phone },
        update: { sessionVersion: { increment: 1 } },
        create: {
          phone,
          // First login from email-OTP path — adopt the delivered-to address.
          email: otp.deliveredTo,
          sessionVersion: 1,
        },
      });
    });

    this.issueSession(res, customer.id, customer.sessionVersion);

    await this.audit.write(AUDIT_EVENT_TYPE.CUSTOMER_OTP_VERIFIED, {
      ...ctx,
      resource: `customer:${customer.id}`,
    });

    return shapeProfile(customer);
  }

  // =====================================================
  // Session helpers
  // =====================================================

  signAccess(customerId: string): string {
    const payload: CustomerAccessPayload = { sub: customerId, type: 'customer_access' };
    return this.jwt.sign(payload, { secret: this.accessSecret, expiresIn: this.accessTtl });
  }

  signRefresh(customerId: string, sessionVersion: number): string {
    const payload: CustomerRefreshPayload = {
      sub: customerId,
      type: 'customer_refresh',
      sv: sessionVersion,
    };
    return this.jwt.sign(payload, { secret: this.refreshSecret, expiresIn: this.refreshTtl });
  }

  verifyAccess(token: string): CustomerAccessPayload {
    return this.jwt.verify<CustomerAccessPayload>(token, { secret: this.accessSecret });
  }

  verifyRefresh(token: string): CustomerRefreshPayload {
    return this.jwt.verify<CustomerRefreshPayload>(token, { secret: this.refreshSecret });
  }

  issueSession(res: Response, customerId: string, sessionVersion: number) {
    const access = this.signAccess(customerId);
    const refresh = this.signRefresh(customerId, sessionVersion);
    res.cookie(CUSTOMER_ACCESS_COOKIE, access, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProd,
      path: CUSTOMER_COOKIE_PATHS.access,
      maxAge: durationToMs(this.accessTtl),
    });
    res.cookie(CUSTOMER_REFRESH_COOKIE, refresh, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProd,
      path: CUSTOMER_COOKIE_PATHS.refresh,
      maxAge: durationToMs(this.refreshTtl),
    });
  }

  reissueAccess(res: Response, customerId: string) {
    const access = this.signAccess(customerId);
    res.cookie(CUSTOMER_ACCESS_COOKIE, access, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProd,
      path: CUSTOMER_COOKIE_PATHS.access,
      maxAge: durationToMs(this.accessTtl),
    });
  }

  clearSession(res: Response) {
    res.clearCookie(CUSTOMER_ACCESS_COOKIE, { path: CUSTOMER_COOKIE_PATHS.access });
    res.clearCookie(CUSTOMER_REFRESH_COOKIE, { path: CUSTOMER_COOKIE_PATHS.refresh });
  }

  // =====================================================
  // Refresh
  // =====================================================

  async refreshSession(refreshToken: string, res: Response): Promise<CustomerProfile> {
    let payload: CustomerRefreshPayload;
    try {
      payload = this.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.type !== 'customer_refresh') throw new UnauthorizedException();
    const customer = await prisma.customer.findUnique({ where: { id: payload.sub } });
    if (!customer || customer.deletedAt || customer.sessionVersion !== payload.sv) {
      throw new UnauthorizedException();
    }
    this.reissueAccess(res, customer.id);
    return shapeProfile(customer);
  }

  // =====================================================
  // Profile read/write
  // =====================================================

  async getProfile(customerId: string): Promise<CustomerProfile> {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.deletedAt) throw new UnauthorizedException();
    return shapeProfile(customer);
  }

  async updateProfile(
    customerId: string,
    body: UpdateCustomerProfileRequest,
    ctx: ActorCtx,
  ): Promise<CustomerProfile> {
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.email !== undefined) {
      // Soft uniqueness check — Customer.email isn't unique in the schema (multiple
      // phones can share an email) but we still surface a friendly error on
      // obvious duplicates so onboarding nudges users toward the right account.
      if (body.email) {
        const collision = await prisma.customer.findFirst({
          where: { email: body.email, id: { not: customerId } },
          select: { id: true },
        });
        if (collision) {
          throw new ConflictException({
            reason: 'email_taken',
            message: 'That email is already linked to another account',
          });
        }
      }
      data.email = body.email;
    }
    const now = new Date();
    if (body.marketingConsentEmail !== undefined) {
      data.marketingConsentEmail = body.marketingConsentEmail;
      data.marketingConsentEmailAt = body.marketingConsentEmail ? now : null;
    }
    if (body.marketingConsentSms !== undefined) {
      data.marketingConsentSms = body.marketingConsentSms;
      data.marketingConsentSmsAt = body.marketingConsentSms ? now : null;
    }
    if (body.marketingConsentWhatsapp !== undefined) {
      data.marketingConsentWhatsapp = body.marketingConsentWhatsapp;
      data.marketingConsentWhatsappAt = body.marketingConsentWhatsapp ? now : null;
    }

    if (Object.keys(data).length === 0) {
      // No-op update — return current profile rather than firing an empty SQL.
      return this.getProfile(customerId);
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data,
    });
    await this.audit.write(AUDIT_EVENT_TYPE.CUSTOMER_PROFILE_UPDATED, {
      ...ctx,
      resource: `customer:${customerId}`,
      payload: { fields: Object.keys(data) },
    });
    return shapeProfile(updated);
  }

  async logout(customerId: string | null, res: Response, ctx: ActorCtx): Promise<void> {
    this.clearSession(res);
    if (customerId) {
      await this.audit.write(AUDIT_EVENT_TYPE.CUSTOMER_LOGOUT, {
        ...ctx,
        resource: `customer:${customerId}`,
      });
    }
  }
}

// =====================================================
// Helpers
// =====================================================

function shapeProfile(c: {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  marketingConsentEmail: boolean;
  marketingConsentSms: boolean;
  marketingConsentWhatsapp: boolean;
  createdAt: Date;
}): CustomerProfile {
  return {
    id: c.id,
    phone: c.phone,
    name: c.name,
    email: c.email,
    marketingConsentEmail: c.marketingConsentEmail,
    marketingConsentSms: c.marketingConsentSms,
    marketingConsentWhatsapp: c.marketingConsentWhatsapp,
    createdAt: c.createdAt.toISOString(),
  };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function generateOtpCode(): string {
  // Cryptographically random 6-digit code. 1,000,000 possibilities × 5-attempt
  // cap × 10-minute window ≈ 0.0005% chance of a successful brute-force.
  const rand = Math.floor(Math.random() * 1_000_000);
  return rand.toString().padStart(6, '0');
}

function required(config: ConfigService, key: string): string {
  const v = config.get<string>(key);
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

function numberOr(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function durationToMs(value: string): number {
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new BadRequestException(`Invalid duration: ${value}`);
  const n = Number(match[1]);
  const unit = match[2];
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return n * mult;
}
