import { SetMetadata } from '@nestjs/common';

// Metadata key consumed by RolesGuard. Routes with @Roles(...) are restricted to
// req.user.role being in the list. Stack the guard *after* JwtAccessGuard so req.user
// has been populated by the JWT strategy.
export const ROLES_KEY = 'roles';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
