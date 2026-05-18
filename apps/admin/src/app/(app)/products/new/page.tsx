import { redirect } from 'next/navigation';
import { AVAILABILITY } from '@repo/types';
import { api } from '@/lib/api';

export const metadata = { title: 'New product' };

// Server Component — runs on the server, creates a draft product with safe
// defaults, then redirects straight to the editor. The single-screen editor
// (Phase 1 of the simplification) does the rest of the work.
//
// Phase 2a (mobile): inherits HSN / GST / availability / returnable from the
// most recently updated product. Most shops have one or two HSN codes total,
// and the GST rate / availability rarely vary from product to product. Saves
// 4 fields of mobile typing on every new product. Operator can override
// inline if needed.
//
// Draft defaults when no inheritable product exists:
//   - isActive: false   → never visible on the storefront until Publish
//   - placeholder name + slug → operator overwrites both first thing
//   - basePricePaisa: 0 → readiness checklist will gate Publish
//   - gstRatePercent: 12 → most common slot for apparel
//   - availabilityFlag: online_shippable → 99% of products
//   - isReturnable: true
interface RecentProductsList {
  items: Array<{ id: string }>;
}

interface ProductDetail {
  hsnCode: string | null;
  gstRatePercent: number | null;
  availabilityFlag: string;
  isReturnable: boolean;
}

export default async function NewProductRedirect() {
  // Slugs are unique. Stitch a high-entropy suffix so two simultaneous +click
  // sessions don't collide.
  const suffix = Math.random().toString(36).slice(2, 10);
  const draftSlug = `draft-${suffix}`;

  // Best-effort inherit. Failures fall through to the static defaults.
  const inheritDefaults = await loadInheritDefaults();

  const res = await api<{ id: string }>('/products', {
    method: 'POST',
    body: {
      slug: draftSlug,
      name: 'Untitled draft',
      basePricePaisa: 0,
      gstRatePercent: inheritDefaults?.gstRatePercent ?? 12,
      hsnCode: inheritDefaults?.hsnCode ?? undefined,
      availabilityFlag: inheritDefaults?.availabilityFlag ?? AVAILABILITY.ONLINE_SHIPPABLE,
      isActive: false,
      isReturnable: inheritDefaults?.isReturnable ?? true,
    },
  });

  if (!res.ok || !res.body) {
    throw new Error('Could not create draft product. Try again.');
  }

  redirect(`/products/${res.body.id}?new=1`);
}

// Loads the most-recently-updated non-deleted product and returns the four
// fields we want to inherit. Returns null when there are no existing products
// (first product in a fresh DB) so the caller falls back to static defaults.
async function loadInheritDefaults(): Promise<
  | {
      hsnCode: string | null;
      gstRatePercent: number | null;
      availabilityFlag: string;
      isReturnable: boolean;
    }
  | null
> {
  const list = await api<RecentProductsList>('/products?page=1&limit=1');
  if (!list.ok || !list.body || list.body.items.length === 0) {
    return null;
  }
  const recent = list.body.items[0];
  const detail = await api<ProductDetail>(`/products/${recent.id}`);
  if (!detail.ok || !detail.body) return null;
  return {
    hsnCode: detail.body.hsnCode,
    gstRatePercent: detail.body.gstRatePercent,
    availabilityFlag: detail.body.availabilityFlag,
    isReturnable: detail.body.isReturnable,
  };
}
