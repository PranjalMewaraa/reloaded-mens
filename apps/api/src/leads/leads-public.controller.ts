import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import {
  LEAD_SOURCE,
  createLeadSchema,
  type CreateLeadRequest,
} from '@repo/types';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { LeadsService } from './leads.service.js';

function reqContext(req: Request) {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip;
  const userAgent = req.headers['user-agent'] ?? null;
  return { ipAddress: ip ?? null, userAgent };
}

// Public lead capture — used by /contact on the storefront. Source is hardcoded
// to website_signup so a malicious caller can't impersonate a Meta-sourced lead.
@Controller('public/leads')
export class LeadsPublicController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  @HttpCode(200)
  async create(
    @Body(new ZodValidationPipe(createLeadSchema)) body: CreateLeadRequest,
    @Req() req: Request,
  ) {
    const lead = await this.leads.create(body, LEAD_SOURCE.WEBSITE_SIGNUP, reqContext(req));
    // Storefront only needs an acknowledgement — never return identifying data
    // to avoid leaking lead state to anonymous callers.
    return { ok: true, id: lead.id };
  }
}
