import { SetMetadata } from '@nestjs/common';
import type { StaffModule } from '@repo/types';

// Metadata key consumed by ModuleGuard. Stack the guard AFTER JwtAccessGuard
// (so req.user is populated) and AFTER RolesGuard (so we know role===staff
// is reachable). Routes that don't @RequireModule(...) are allowed for
// anyone whose role passes RolesGuard.
//
// Admins (role=admin) bypass this check entirely — the guard short-circuits
// before reading metadata. Staff users must have the matching slug in their
// AdminUser.permissions array; see STAFF_MODULE in @repo/types for valid
// values.
//
// Example:
//   @Controller('orders')
//   @UseGuards(JwtAccessGuard, RolesGuard, ModuleGuard)
//   @Roles(ADMIN_ROLE.ADMIN, ADMIN_ROLE.STAFF)
//   @RequireModule(STAFF_MODULE.ORDERS)
//   export class AdminOrdersController { ... }
export const REQUIRE_MODULE_KEY = 'require_module';

export const RequireModule = (module: StaffModule) => SetMetadata(REQUIRE_MODULE_KEY, module);
