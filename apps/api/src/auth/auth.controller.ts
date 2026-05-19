import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  AUDIT_EVENT_TYPE,
  AUTH_STAGE,
  loginRequestSchema,
  totpVerifyRequestSchema,
  type LoginRequest,
  type TotpVerifyRequest,
} from '@repo/types';
import { prisma } from '@repo/db';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { AuditService } from '../audit/audit.service.js';
import { AuthService } from './auth.service.js';
import { TotpService } from './totp.service.js';
import { JwtAccessGuard } from './guards/jwt-access.guard.js';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard.js';
import { RequireStage, StageGuard } from './guards/stage.guard.js';

interface AuthedUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface StagedUser extends AuthedUser {
  step: 'totp' | 'totp_enroll';
}

function reqContext(req: Request) {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip;
  const userAgent = req.headers['user-agent'] ?? null;
  return { ipAddress: ip ?? null, userAgent };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly totp: TotpService,
    private readonly audit: AuditService,
  ) {}

  // POST /auth/login — step 1: email + password.
  // On success: sets stage_token cookie and returns the next stage the client should drive.
  @Post('login')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(loginRequestSchema))
  async login(
    @Body() body: LoginRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = reqContext(req);
    const user = await this.auth.verifyPassword(body.email, body.password);

    await this.audit.write(AUDIT_EVENT_TYPE.ADMIN_LOGIN_ATTEMPT, {
      ...ctx,
      adminUserId: user?.id ?? null,
      payload: { email: body.email, success: Boolean(user) },
    });

    if (!user) {
      await this.audit.write(AUDIT_EVENT_TYPE.ADMIN_LOGIN_FAILURE, {
        ...ctx,
        payload: { email: body.email, reason: 'invalid_credentials' },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    // MVP bypass: if ADMIN_TOTP_REQUIRED=false, skip the TOTP step entirely and issue
    // a session right here. Code paths for TOTP remain — flipping the flag re-enforces.
    if (!this.auth.totpRequired) {
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      this.auth.issueSession(res, user.id);
      await this.audit.write(AUDIT_EVENT_TYPE.ADMIN_LOGIN_SUCCESS, {
        ...ctx,
        adminUserId: user.id,
        payload: { totp: 'bypassed' },
      });
      return { stage: AUTH_STAGE.COMPLETE };
    }

    const step: 'totp' | 'totp_enroll' = user.totpEnabledAt ? 'totp' : 'totp_enroll';
    this.auth.issueStage(res, user.id, step);

    return {
      stage: step === 'totp' ? AUTH_STAGE.TOTP_REQUIRED : AUTH_STAGE.TOTP_ENROLLMENT_REQUIRED,
    };
  }

  // POST /auth/totp/setup — requires stage step 'totp_enroll'.
  // Generates a fresh TOTP secret, persists it on the user (totpEnabledAt stays null until verified),
  // and returns the QR + base32 secret for the admin app to render.
  @Post('totp/setup')
  @HttpCode(200)
  @UseGuards(StageGuard, RequireStage('totp_enroll'))
  async totpSetup(@Req() req: Request) {
    const user = req.user as StagedUser;
    const setup = await this.totp.setup(user.email);
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { totpSecret: setup.secretBase32 },
    });
    return {
      qrDataUrl: setup.qrDataUrl,
      otpauthUri: setup.otpauthUri,
      secretBase32: setup.secretBase32,
    };
  }

  // POST /auth/totp/enroll — verifies the user's first TOTP code and finalizes enrollment.
  @Post('totp/enroll')
  @HttpCode(200)
  @UseGuards(StageGuard, RequireStage('totp_enroll'))
  @UsePipes(new ZodValidationPipe(totpVerifyRequestSchema))
  async totpEnroll(
    @Body() body: TotpVerifyRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const staged = req.user as StagedUser;
    const ctx = reqContext(req);
    const user = await prisma.adminUser.findUnique({ where: { id: staged.id } });
    if (!user || !user.totpSecret) {
      throw new UnauthorizedException('No pending TOTP secret');
    }

    const ok = this.totp.verify(body.code, user.totpSecret);
    if (!ok) {
      await this.audit.write(AUDIT_EVENT_TYPE.ADMIN_TOTP_FAILURE, {
        ...ctx,
        adminUserId: user.id,
        payload: { stage: 'enroll' },
      });
      throw new UnauthorizedException('Invalid code');
    }

    const now = new Date();
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { totpEnabledAt: now, lastLoginAt: now },
    });

    this.auth.clearStage(res);
    this.auth.issueSession(res, user.id);

    await this.audit.write(AUDIT_EVENT_TYPE.ADMIN_TOTP_ENROLLED, { ...ctx, adminUserId: user.id });
    await this.audit.write(AUDIT_EVENT_TYPE.ADMIN_LOGIN_SUCCESS, { ...ctx, adminUserId: user.id });

    return { ok: true };
  }

  // POST /auth/totp/verify — step 2 for users with TOTP already enrolled.
  @Post('totp/verify')
  @HttpCode(200)
  @UseGuards(StageGuard, RequireStage('totp'))
  @UsePipes(new ZodValidationPipe(totpVerifyRequestSchema))
  async totpVerify(
    @Body() body: TotpVerifyRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const staged = req.user as StagedUser;
    const ctx = reqContext(req);
    const user = await prisma.adminUser.findUnique({ where: { id: staged.id } });
    if (!user || !user.totpSecret || !user.totpEnabledAt) {
      throw new UnauthorizedException('TOTP not enrolled');
    }

    const ok = this.totp.verify(body.code, user.totpSecret);
    if (!ok) {
      await this.audit.write(AUDIT_EVENT_TYPE.ADMIN_TOTP_FAILURE, {
        ...ctx,
        adminUserId: user.id,
        payload: { stage: 'verify' },
      });
      throw new UnauthorizedException('Invalid code');
    }

    await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    this.auth.clearStage(res);
    this.auth.issueSession(res, user.id);

    await this.audit.write(AUDIT_EVENT_TYPE.ADMIN_TOTP_SUCCESS, { ...ctx, adminUserId: user.id });
    await this.audit.write(AUDIT_EVENT_TYPE.ADMIN_LOGIN_SUCCESS, { ...ctx, adminUserId: user.id });

    return { ok: true };
  }

  // POST /auth/refresh — re-issues access cookie. Refresh itself stays the same until expiry.
  @Post('refresh')
  @HttpCode(200)
  @UseGuards(JwtRefreshGuard)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as AuthedUser;
    const ctx = reqContext(req);
    this.auth.reissueAccess(res, user.id);
    await this.audit.write(AUDIT_EVENT_TYPE.ADMIN_TOKEN_REFRESHED, {
      ...ctx,
      adminUserId: user.id,
    });
    return { ok: true };
  }

  // POST /auth/logout — clears cookies. Idempotent: must succeed even when
  // the access cookie is expired/invalid/missing. Previously this was guarded
  // by JwtAccessGuard, which 401'd stale-cookie logout attempts — the api
  // never sent Set-Cookie clears, the admin's mirror saw an empty array, the
  // browser kept the cookie, and the user stayed logged in.
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Best-effort decode of the access cookie so we can audit-log which admin
    // signed out. Missing/invalid cookie just means we log without a userId.
    let adminUserId: string | undefined;
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    const token = cookies?.['access_token'];
    if (token) {
      try {
        adminUserId = this.auth.verifyAccess(token).sub;
      } catch {
        // Invalid or expired — fall through and clear anyway.
      }
    }

    this.auth.clearSession(res);
    await this.audit.write(AUDIT_EVENT_TYPE.ADMIN_LOGOUT, {
      ...reqContext(req),
      ...(adminUserId ? { adminUserId } : {}),
    });
    return { ok: true };
  }

  // GET /auth/me — current admin user (used by Next.js Server Components).
  @Get('me')
  @UseGuards(JwtAccessGuard)
  me(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return user;
  }
}
