'use client';

import * as React from 'react';
import { KeyRound, MoreHorizontal, Plus, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  ADMIN_ROLE,
  STAFF_MODULE,
  STAFF_MODULES,
  type AdminStaff,
  type StaffModule,
} from '@repo/types';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  createStaffAction,
  deactivateStaffAction,
  resetStaffPasswordAction,
  updateStaffAction,
} from './actions';

interface Props {
  items: AdminStaff[];
  // The signed-in admin's id — we hide destructive actions on this row so
  // they can't accidentally lock themselves out. The api enforces the same
  // rule server-side; this is purely a UX nicety.
  currentAdminId: string;
}

// Human labels for each module slug — order here drives the order in the
// permission-toggle grid below.
const MODULE_LABELS: Record<StaffModule, string> = {
  [STAFF_MODULE.ORDERS]: 'Orders',
  [STAFF_MODULE.RETURNS]: 'Returns',
  [STAFF_MODULE.REFUNDS]: 'Refunds',
  [STAFF_MODULE.INVENTORY]: 'Inventory',
  [STAFF_MODULE.PRODUCTS]: 'Products',
  [STAFF_MODULE.CATEGORIES]: 'Categories',
  [STAFF_MODULE.PROMOTIONS]: 'Promotions',
  [STAFF_MODULE.LEADS]: 'Leads',
  [STAFF_MODULE.REVIEWS]: 'Reviews',
  [STAFF_MODULE.CUSTOMERS]: 'Customers',
};

export function StaffList({ items, currentAdminId }: Props) {
  // Which staff (if any) is currently being edited via the dialog. `null`
  // means closed; `{ mode: 'create' }` opens the empty create form;
  // `{ mode: 'edit', staff }` opens the edit form pre-filled.
  const [dialog, setDialog] = React.useState<
    | { mode: 'create' }
    | { mode: 'edit'; staff: AdminStaff }
    | { mode: 'reset'; staff: AdminStaff }
    | null
  >(null);

  return (
    <>
      <div className="mt-6 flex justify-end">
        <Button onClick={() => setDialog({ mode: 'create' })}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add staff
        </Button>
      </div>

      <ul className="mt-3 space-y-2">
        {items.map((s) => {
          const isMe = s.id === currentAdminId;
          return (
            <li key={s.id} className="rounded-2xl border border-ink-100 bg-snow p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink-900">{s.name}</span>
                    {s.role === ADMIN_ROLE.ADMIN ? (
                      <Pill tone="info">Admin</Pill>
                    ) : (
                      <Pill tone="neutral">Staff</Pill>
                    )}
                    {!s.isActive ? <Pill tone="danger">Disabled</Pill> : null}
                    {isMe ? <Pill tone="moss">You</Pill> : null}
                  </div>
                  <p className="mt-1 font-mono text-[12px] text-ink-600">{s.email}</p>
                  {s.role === ADMIN_ROLE.STAFF ? (
                    <p className="mt-2 text-[12px] text-ink-500">
                      {s.permissions.length === 0
                        ? 'No modules granted yet.'
                        : `Access: ${s.permissions
                            .map((p) => MODULE_LABELS[p] ?? p)
                            .join(' · ')}`}
                    </p>
                  ) : null}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" aria-label="Open staff actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => setDialog({ mode: 'edit', staff: s })}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDialog({ mode: 'reset', staff: s })}>
                      <KeyRound className="mr-2 h-3.5 w-3.5" />
                      Reset password
                    </DropdownMenuItem>
                    {!isMe && s.isActive ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-danger focus:text-danger"
                          onClick={async () => {
                            if (!confirm(`Disable ${s.name}'s account?`)) return;
                            const res = await deactivateStaffAction(s.id);
                            if (!res.ok) toast.error(res.error ?? 'Failed');
                            else toast.success('Account disabled');
                          }}
                        >
                          <ShieldOff className="mr-2 h-3.5 w-3.5" />
                          Disable
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>

      {dialog?.mode === 'create' ? (
        <StaffFormDialog onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.mode === 'edit' ? (
        <StaffFormDialog staff={dialog.staff} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.mode === 'reset' ? (
        <ResetPasswordDialog staff={dialog.staff} onClose={() => setDialog(null)} />
      ) : null}
    </>
  );
}

// One dialog for both create and edit. Detects mode by presence of `staff`.
function StaffFormDialog({ staff, onClose }: { staff?: AdminStaff; onClose: () => void }) {
  const isEdit = Boolean(staff);
  const [name, setName] = React.useState(staff?.name ?? '');
  const [email, setEmail] = React.useState(staff?.email ?? '');
  const [password, setPassword] = React.useState('');
  const [role, setRole] = React.useState<'admin' | 'staff'>(staff?.role ?? 'staff');
  const [permissions, setPermissions] = React.useState<StaffModule[]>(
    staff?.permissions ?? [],
  );
  const [isActive, setIsActive] = React.useState(staff?.isActive ?? true);
  const [submitting, setSubmitting] = React.useState(false);

  function togglePermission(m: StaffModule) {
    setPermissions((prev) => (prev.includes(m) ? prev.filter((p) => p !== m) : [...prev, m]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = isEdit
      ? await updateStaffAction(staff!.id, { name, role, permissions, isActive })
      : await createStaffAction({ name, email, password, role, permissions });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error ?? 'Failed');
      return;
    }
    toast.success(isEdit ? 'Staff updated' : 'Staff added');
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/* max-h + overflow-y-auto so the dialog scrolls internally on shorter
          viewports (e.g. laptops) instead of clipping the top of the form.
          The header stays at the top of the scrollable area; the footer is
          a sibling so it stays sticky at the bottom. */}
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${staff!.name}` : 'Add staff'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Adjust role + which modules this user can access. Email changes need a new account.'
              : 'New users get the password you set here. They can change it from their profile later.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="-mx-6 flex-1 space-y-4 overflow-y-auto px-6">
          <div className="space-y-1">
            <Label htmlFor="staff-name">Name</Label>
            <Input
              id="staff-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
            />
          </div>

          {!isEdit ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="staff-password">Temporary password</Label>
                <Input
                  id="staff-password"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <p className="text-[11px] text-ink-500">
                  Min 8 chars. Share securely; they can change it after first login.
                </p>
              </div>
            </>
          ) : null}

          <div className="space-y-1.5">
            <Label>Role</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRole('staff')}
                className={`flex-1 rounded-md border px-3 py-2 text-[12.5px] ${
                  role === 'staff'
                    ? 'border-ink-900 bg-ink-50 text-ink-900'
                    : 'border-ink-200 text-ink-700'
                }`}
              >
                Staff
              </button>
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`flex-1 rounded-md border px-3 py-2 text-[12.5px] ${
                  role === 'admin'
                    ? 'border-ink-900 bg-ink-50 text-ink-900'
                    : 'border-ink-200 text-ink-700'
                }`}
              >
                Admin
              </button>
            </div>
            <p className="text-[11px] text-ink-500">
              Admins bypass module gating and can manage staff. Staff are scoped to the modules
              you tick below.
            </p>
          </div>

          {role === 'staff' ? (
            <div className="space-y-1.5">
              <Label>Modules</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {STAFF_MODULES.map((m) => (
                  <label
                    key={m}
                    className="flex items-center gap-2 rounded-md border border-ink-100 bg-snow px-2.5 py-1.5 text-[12.5px] hover:border-ink-300"
                  >
                    <Checkbox
                      checked={permissions.includes(m)}
                      onCheckedChange={() => togglePermission(m)}
                    />
                    <span>{MODULE_LABELS[m]}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {isEdit ? (
            <label className="flex items-center gap-2 text-[12.5px] text-ink-700">
              <Checkbox
                checked={isActive}
                onCheckedChange={(v) => setIsActive(v === true)}
              />
              Active (uncheck to disable login)
            </label>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add staff'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ staff, onClose }: { staff: AdminStaff; onClose: () => void }) {
  const [password, setPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await resetStaffPasswordAction(staff.id, { password });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error ?? 'Failed');
      return;
    }
    toast.success(`Password reset for ${staff.name}. Their TOTP was cleared too — they'll re-enrol on next login.`);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password — {staff.name}</DialogTitle>
          <DialogDescription>
            Sets a new password and clears any TOTP enrolment so they can sign in fresh.
            Share the password securely out-of-band.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="reset-password">New password</Label>
            <Input
              id="reset-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Resetting…' : 'Reset password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
