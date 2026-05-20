-- Add per-module permissions to AdminUser.
--
-- New `permissions` Json column on AdminUser holds an array of module slugs
-- (orders / returns / inventory / etc — see STAFF_MODULE in @repo/types).
-- Admins (role='admin') bypass module gating; staff (role='staff') must have
-- the matching slug in this array to be allowed through the module guard.
--
-- Existing rows: we backfill with ALL known module slugs so any pre-existing
-- staff account keeps working until an admin reviews their access. New rows
-- default to '[]' (no modules) so newly-created staff start locked-down by
-- default — admin grants modules on creation.

ALTER TABLE "AdminUser" ADD COLUMN "permissions" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill existing rows (both admin + staff) with the full set so nobody
-- gets locked out mid-deploy. Admins ignore this field anyway; staff get a
-- "grandfathered in" full grant that an admin can scope down later.
UPDATE "AdminUser"
SET "permissions" = '["orders","returns","refunds","inventory","products","categories","promotions","leads","reviews","customers"]'::jsonb
WHERE "permissions" = '[]'::jsonb;
