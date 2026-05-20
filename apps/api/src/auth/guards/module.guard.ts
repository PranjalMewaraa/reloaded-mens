import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_ROLE, type StaffModule } from '@repo/types';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator.js';
import type { AuthedUser } from '../decorators/user.decorator.js';

// Enforces @RequireModule() metadata against req.user.permissions for staff
// accounts. Admins bypass entirely; users without any required module
// metadata also bypass (the decorator is opt-in).
//
// Sits AFTER JwtAccessGuard + RolesGuard in @UseGuards(). RolesGuard has
// already rejected anonymous + role-mismatched callers by the time this
// runs, so we only need to reason about the staff-with-modules case.
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<StaffModule | undefined>(REQUIRE_MODULE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    // No module requirement on this route — allow.
    if (!required) return true;

    const request = ctx.switchToHttp().getRequest<{ user?: AuthedUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    // Admins skip module gating entirely. The role check is upstream of this
    // guard (RolesGuard); here we just trust the role string the strategy
    // populated from the DB.
    if (user.role === ADMIN_ROLE.ADMIN) return true;

    if (user.permissions.includes(required)) return true;

    throw new ForbiddenException(
      `You don't have access to the "${required}" module. Ask an admin to grant it.`,
    );
  }
}
