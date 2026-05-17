import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

// Parameter decorator: @User() user → req.user; @User('id') id → req.user.id.
// Returns undefined if no JwtAccessGuard ran (don't use on unprotected routes).
export const User = createParamDecorator(
  (field: keyof AuthedUser | undefined, ctx: ExecutionContext): AuthedUser | string | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthedUser }>();
    const user = request.user;
    if (!user) return undefined;
    return field ? user[field] : user;
  },
);
