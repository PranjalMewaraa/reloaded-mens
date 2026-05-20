import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ADMIN_ROLE,
  type AdminStaff,
  type AdminStaffListResponse,
  type CreateAdminStaffRequest,
  type StaffModule,
  STAFF_MODULES,
  type UpdateAdminStaffRequest,
} from '@repo/types';
import { prisma, Prisma } from '@repo/db';
import bcrypt from 'bcryptjs';

// CRUD for admin/staff accounts. All callers must already be guarded by
// JwtAccessGuard + RolesGuard(ADMIN) at the controller — this service
// assumes the actor has full authority over the AdminUser table.

@Injectable()
export class AdminStaffService {
  async list(): Promise<AdminStaffListResponse> {
    const rows = await prisma.adminUser.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
    return { items: rows.map(shape) };
  }

  async get(id: string): Promise<AdminStaff> {
    const row = await prisma.adminUser.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Staff user ${id} not found`);
    return shape(row);
  }

  async create(input: CreateAdminStaffRequest): Promise<AdminStaff> {
    const existing = await prisma.adminUser.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException(`Email ${input.email} is already in use`);

    const cleanPermissions = sanitisePermissions(input.permissions, input.role);
    const passwordHash = await bcrypt.hash(input.password, 10);

    const row = await prisma.adminUser.create({
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        permissions: cleanPermissions,
        passwordHash,
      },
    });
    return shape(row);
  }

  async update(id: string, input: UpdateAdminStaffRequest, actorId: string): Promise<AdminStaff> {
    const existing = await prisma.adminUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Staff user ${id} not found`);

    // Safety rail: an admin can't lock themselves out by demoting/deactivating
    // their own row in the same request. They can demote OTHER admins, just
    // not themselves — keeps "lost the keys" recovery cases from spiralling.
    if (id === actorId) {
      if (input.role && input.role !== existing.role) {
        throw new BadRequestException("You can't change your own role");
      }
      if (input.isActive === false) {
        throw new BadRequestException("You can't deactivate your own account");
      }
    }

    const nextRole = input.role ?? (existing.role as 'admin' | 'staff');
    const nextPermissions = input.permissions
      ? sanitisePermissions(input.permissions, nextRole)
      : undefined;

    const updated = await prisma.adminUser.update({
      where: { id },
      data: {
        name: input.name,
        role: input.role,
        permissions: nextPermissions,
        isActive: input.isActive,
      },
    });
    return shape(updated);
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    const existing = await prisma.adminUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Staff user ${id} not found`);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.adminUser.update({
      where: { id },
      data: { passwordHash, totpSecret: null, totpEnabledAt: null },
    });
    // Note: clears totp too so the staff user has to re-enrol after their
    // password is reset by an admin — covers the lost-phone case.
  }

  async deactivate(id: string, actorId: string): Promise<void> {
    if (id === actorId) {
      throw new BadRequestException("You can't deactivate your own account");
    }
    const existing = await prisma.adminUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Staff user ${id} not found`);
    await prisma.adminUser.update({ where: { id }, data: { isActive: false } });
  }
}

// Trim a permissions input down to known module slugs only — guards against a
// renamed/dropped module slipping into the DB. Admins always get the full
// list (their permissions field is meaningless but kept in sync for symmetry).
function sanitisePermissions(input: StaffModule[], role: 'admin' | 'staff'): StaffModule[] {
  if (role === ADMIN_ROLE.ADMIN) return [...STAFF_MODULES];
  const allowed = new Set(STAFF_MODULES);
  return [...new Set(input.filter((p) => allowed.has(p)))];
}

function shape(row: {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: Prisma.JsonValue;
  isActive: boolean;
  totpEnabledAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}): AdminStaff {
  const perms = Array.isArray(row.permissions) ? (row.permissions as StaffModule[]) : [];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as 'admin' | 'staff',
    permissions: perms,
    isActive: row.isActive,
    totpEnabledAt: row.totpEnabledAt ? row.totpEnabledAt.toISOString() : null,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
