import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { StageStep } from '../auth.service.js';

@Injectable()
export class StageGuard extends AuthGuard('stage') {}

// Factory to require a specific step on the stage token (e.g. only 'totp_enroll').
// Use as @UseGuards(StageGuard, RequireStage('totp_enroll'))
export function RequireStage(step: StageStep) {
  @Injectable()
  class StageStepGuard implements CanActivate {
    canActivate(ctx: ExecutionContext): boolean {
      const req = ctx.switchToHttp().getRequest<{ user?: { step?: StageStep } }>();
      if (req.user?.step !== step) {
        throw new UnauthorizedException(`Wrong auth stage`);
      }
      return true;
    }
  }
  return StageStepGuard;
}
