'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductImage, UpdateProductInput } from '@repo/types';
import { SaveBar } from '@/components/shell/save-bar';
import type { CategoryRow } from '../../categories/categories-client';
import { setProductCategoriesAction, updateProductAction } from './actions';
import { VariantsTab, type EditorVariant } from './tabs/variants-tab';
import { ImagesTab } from './tabs/images-tab';
import { CategoriesTab } from './tabs/categories-tab';
import { SeoTab } from './tabs/seo-tab';
import { HeaderSection } from './tabs/header-section';
import { MobileSectionTile } from './tabs/mobile-section-tile';
import { MobileTopBar } from './tabs/mobile-top-bar';
import { PricingSection } from './tabs/pricing-section';
import { DetailsSection } from './tabs/details-section';

export type { EditorVariant } from './tabs/variants-tab';

export interface EditorProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  hsnCode: string | null;
  gstRatePercent: number | null;
  availabilityFlag: string;
  basePricePaisa: number;
  compareAtPricePaisa: number | null;
  costPricePaisa: number | null;
  isActive: boolean;
  isReturnable: boolean;
  images: ProductImage[];
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  variants: EditorVariant[];
  categoryIds: string[];
}

interface ProductEditorProps {
  product: EditorProduct;
  categoriesTree: CategoryRow[];
}

const AUTOSAVE_DEBOUNCE_MS = 1500;
// Storage backup of dirty fields is keyed by product id so two tabs editing
// two different products don't stomp on each other.
const SESSION_KEY_PREFIX = 'reloaded.admin.product-draft.';

// Autosave status — surfaced next to the publish pill so the operator knows
// their work is safe without having to scroll to the SaveBar.
type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

// Single source of truth for the form state. Mutations are local; the autosave
// timer pushes a PATCH for product-field diffs every AUTOSAVE_DEBOUNCE_MS of
// idle, while the SaveBar at the bottom forces an immediate flush + commits
// the categories PUT (which we keep out of autosave because it's a "list set"
// change the operator usually wants to confirm explicitly).
//
// Phase 2 (Sprint 9):
//   - Phase 1 collapsed tabs into a single screen
//   - Phase 2b: autosave + sessionStorage backup + Saved indicator. SaveBar
//     stays for explicit "I'm done with this section" commits (category set,
//     image list reorder).
export function ProductEditor({ product, categoriesTree }: ProductEditorProps) {
  const router = useRouter();
  const [pristine, setPristine] = React.useState(product);
  const [draft, setDraft] = React.useState(product);
  const [saving, setSaving] = React.useState(false);
  const [autoStatus, setAutoStatus] = React.useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);
  const autosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track which fields have been edited locally so a router.refresh() that
  // re-hydrates `product` doesn't blow away an in-flight edit.
  const localChangesRef = React.useRef<Set<keyof EditorProduct>>(new Set());

  const sessionKey = `${SESSION_KEY_PREFIX}${product.id}`;

  // Rehydrate any sessionStorage backup that differs from the server payload.
  // Runs once on mount so a backgrounded tab → reload doesn't lose work. We
  // compare the backed-up draft to the just-fetched `product` and only
  // restore when there's a meaningful diff — covers the "saved already" case.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(sessionKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { draft: EditorProduct } | null;
      if (parsed?.draft && !shallowEqualEditable(parsed.draft, product)) {
        setDraft(parsed.draft);
        toast.message('Restored unsaved changes', {
          description: 'We held on to what you were typing.',
        });
      } else if (parsed?.draft) {
        // Backup matches server → drop it.
        window.sessionStorage.removeItem(sessionKey);
      }
    } catch {
      // Bad JSON or browser refused sessionStorage — silently fall through.
    }
    // Run once per mount; product.id rarely changes for the lifetime of this component.
  }, [sessionKey]);

  // Reset state when the server-side data changes (e.g. after router.refresh()).
  // We keep any local fields the operator just edited so the refresh doesn't
  // overwrite in-progress typing.
  React.useEffect(() => {
    setPristine(product);
    setDraft((current) => {
      const next = { ...product };
      // Preserve any fields the operator has locally changed since the last
      // server reconciliation.
      for (const key of localChangesRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (next as any)[key] = (current as any)[key];
      }
      return next;
    });
  }, [product]);

  const dirty = React.useMemo(() => !shallowEqualEditable(draft, pristine), [draft, pristine]);
  const dirtyForCategories = React.useMemo(
    () => !arraysEqual(draft.categoryIds, pristine.categoryIds),
    [draft.categoryIds, pristine.categoryIds],
  );

  function patch<K extends keyof EditorProduct>(key: K, value: EditorProduct[K]) {
    localChangesRef.current.add(key);
    setDraft((d) => ({ ...d, [key]: value }));
  }

  // Persist a backup of the dirty draft to sessionStorage on every change.
  // Cheap — JSON of ~3 kB per product, much less than the 5 MB sessionStorage
  // cap. Belt-and-braces with autosave (covers the brief window between a
  // keystroke and the first PATCH landing).
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!dirty) {
      // Clean draft → drop the backup so we don't re-restore it next time.
      try {
        window.sessionStorage.removeItem(sessionKey);
      } catch {
        // ignore
      }
      return;
    }
    try {
      window.sessionStorage.setItem(
        sessionKey,
        JSON.stringify({ savedAt: Date.now(), draft }),
      );
    } catch {
      // sessionStorage full or disabled — fall through.
    }
  }, [draft, dirty, sessionKey]);

  // -------- Autosave loop --------

  const runAutosave = React.useCallback(
    async (target: EditorProduct, basis: EditorProduct) => {
      // Compute diff against the basis (last-known pristine) and PATCH.
      // Skip categories — those go through the SaveBar PUT path.
      const productChanges = buildProductDiff(target, basis);
      if (Object.keys(productChanges).length === 0) {
        setAutoStatus('idle');
        return;
      }
      setAutoStatus('saving');
      const result = await updateProductAction(target.id, productChanges);
      if (!result.ok) {
        setAutoStatus('error');
        return;
      }
      // Roll forward pristine for the fields we just committed so subsequent
      // diffs don't include them.
      setPristine((prev) => mergeProductChanges(prev, productChanges, target));
      // Drop the just-committed fields from localChangesRef so a later
      // server refresh can claim them again.
      Object.keys(productChanges).forEach((k) =>
        localChangesRef.current.delete(k as keyof EditorProduct),
      );
      setLastSavedAt(Date.now());
      setAutoStatus('saved');
    },
    [],
  );

  React.useEffect(() => {
    // Skip autosave when there's nothing to push.
    if (!dirty || dirtyForCategories && !hasNonCategoryDiff(draft, pristine)) {
      // Categories-only dirty → SaveBar handles it; no autosave noise.
      return;
    }
    setAutoStatus('pending');
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      void runAutosave(draft, pristine);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [draft, pristine, dirty, dirtyForCategories, runAutosave]);

  // PublishControl flips isActive against the saved record (not the draft) so we
  // also bump both pristine + draft to keep the local state honest.
  function handlePublishedChange(next: boolean) {
    setPristine((p) => ({ ...p, isActive: next }));
    setDraft((d) => ({ ...d, isActive: next }));
    router.refresh();
  }

  async function handleSave() {
    // Cancel any pending autosave so we don't double-fire.
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    setSaving(true);
    setAutoStatus('saving');
    try {
      const productChanges = buildProductDiff(draft, pristine);

      if (Object.keys(productChanges).length > 0) {
        const result = await updateProductAction(product.id, productChanges);
        if (!result.ok) {
          setAutoStatus('error');
          toast.error(result.error ?? 'Save failed');
          return;
        }
      }

      // Category assignments — only PUT if the set changed (order matters too).
      if (!arraysEqual(draft.categoryIds, pristine.categoryIds)) {
        const result = await setProductCategoriesAction(product.id, {
          categoryIds: draft.categoryIds,
        });
        if (!result.ok) {
          setAutoStatus('error');
          toast.error(result.error ?? 'Category update failed');
          return;
        }
      }

      toast.success('Product saved');
      setPristine(draft);
      localChangesRef.current.clear();
      setLastSavedAt(Date.now());
      setAutoStatus('saved');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setDraft(pristine);
    localChangesRef.current.clear();
    setAutoStatus('idle');
    // Drop any sessionStorage backup so we don't resurrect it after a reload.
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(sessionKey);
      } catch {
        // ignore
      }
    }
  }

  return (
    <div className="space-y-4 px-5 py-5 pb-32 md:px-8 md:py-6">
      <MobileTopBar
        draft={draft}
        productId={product.id}
        autoStatus={autoStatus}
        lastSavedAt={lastSavedAt}
        onPublishedChange={handlePublishedChange}
      />
      <HeaderSection
        draft={draft}
        patch={patch}
        productId={product.id}
        dirty={dirty}
        autoStatus={autoStatus}
        lastSavedAt={lastSavedAt}
        onPublishedChange={handlePublishedChange}
      />
      <ImagesTab images={draft.images} onChange={(images) => patch('images', images)} />
      <PricingSection draft={draft} patch={patch} />
      <VariantsTab productId={product.id} variants={draft.variants} />

      {/* Categories — inline on desktop, tile-with-sheet on mobile. */}
      <MobileSectionTile
        title="Categories"
        summary={categoriesSummary(draft.categoryIds, categoriesTree) ?? 'None selected'}
      >
        <CategoriesTab
          tree={categoriesTree}
          value={draft.categoryIds}
          onChange={(categoryIds) => patch('categoryIds', categoryIds)}
        />
      </MobileSectionTile>

      {/* Details (description + availability + returnable) — same pattern. */}
      <MobileSectionTile title="Details" summary={detailsSummary(draft)}>
        <DetailsSection draft={draft} patch={patch} />
      </MobileSectionTile>

      {/* SEO — desktop disclosure stays; mobile gets its own tile so it
          matches the other secondary sections. */}
      <div className="md:hidden">
        <MobileSectionTile title="SEO & social" summary={seoSummary(draft)}>
          <SeoTab draft={draft} patch={patch} />
        </MobileSectionTile>
      </div>
      <details className="group hidden md:block">
        <summary className="cursor-pointer list-none rounded-2xl border border-ink-100 bg-snow px-5 py-3 text-[13px] font-medium text-ink-900 hover:bg-ink-50/40">
          <span className="inline-block transition group-open:rotate-90">›</span> SEO &amp; social
          preview
        </summary>
        <div className="mt-2">
          <SeoTab draft={draft} patch={patch} />
        </div>
      </details>
      <SaveBar dirty={dirty} saving={saving} onDiscard={handleDiscard} onSave={handleSave} />
    </div>
  );
}

// =====================================================
// Summary helpers — render the one-line preview each mobile tile shows when
// collapsed. Pure functions so they're cheap to recompute on every render.
// =====================================================

function categoriesSummary(ids: string[], tree: CategoryRow[]): string | null {
  if (ids.length === 0) return null;
  const byId = flattenTree(tree);
  const names = ids.map((id) => byId.get(id)?.name).filter(Boolean) as string[];
  if (names.length === 0) return null;
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
}

function flattenTree(tree: CategoryRow[]): Map<string, CategoryRow> {
  const out = new Map<string, CategoryRow>();
  function walk(nodes: CategoryRow[]) {
    for (const n of nodes) {
      out.set(n.id, n);
      walk(n.children);
    }
  }
  walk(tree);
  return out;
}

function detailsSummary(draft: EditorProduct): string {
  const parts: string[] = [];
  if (draft.description) {
    parts.push(draft.description.length > 60 ? `${draft.description.slice(0, 60)}…` : draft.description);
  } else {
    parts.push('No description');
  }
  parts.push(draft.availabilityFlag.replace(/_/g, ' '));
  if (!draft.isReturnable) parts.push('Non-returnable');
  return parts.join(' · ');
}

function seoSummary(draft: EditorProduct): string {
  if (draft.seoTitle || draft.seoDescription) {
    return draft.seoTitle ?? 'Custom SEO description';
  }
  return 'Defaults from product name + description';
}

// =====================================================
// Autosave status pill — small visual next to the publish control.
// =====================================================

export function AutoSaveStatus({
  status,
  lastSavedAt,
}: {
  status: SaveStatus;
  lastSavedAt: number | null;
}) {
  // Hide entirely when there's nothing meaningful to say.
  if (status === 'idle' && lastSavedAt === null) return null;

  let icon: React.ReactNode = null;
  let text = '';
  let tone = 'text-ink-500';
  if (status === 'pending') {
    text = 'Will save…';
  } else if (status === 'saving') {
    icon = <Loader2 className="h-3 w-3 animate-spin" />;
    text = 'Saving…';
  } else if (status === 'saved') {
    icon = <Check className="h-3 w-3" />;
    text = 'Saved';
    tone = 'text-success';
  } else if (status === 'error') {
    text = 'Save failed';
    tone = 'text-danger';
  } else if (lastSavedAt) {
    icon = <Check className="h-3 w-3" />;
    text = 'Saved';
    tone = 'text-ink-500';
  }
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-caps ${tone}`}
    >
      {icon}
      {text}
    </span>
  );
}

// =====================================================
// Equality + diff helpers — compare only the fields managed by the global save.
// =====================================================

function buildProductDiff(draft: EditorProduct, basis: EditorProduct): UpdateProductInput {
  const out: UpdateProductInput = {};
  if (draft.slug !== basis.slug) out.slug = draft.slug;
  if (draft.name !== basis.name) out.name = draft.name;
  if (draft.description !== basis.description) out.description = draft.description ?? null;
  if (draft.hsnCode !== basis.hsnCode) out.hsnCode = draft.hsnCode ?? null;
  if (draft.gstRatePercent !== basis.gstRatePercent)
    out.gstRatePercent = draft.gstRatePercent ?? null;
  if (draft.availabilityFlag !== basis.availabilityFlag)
    out.availabilityFlag = draft.availabilityFlag as UpdateProductInput['availabilityFlag'];
  if (draft.basePricePaisa !== basis.basePricePaisa) out.basePricePaisa = draft.basePricePaisa;
  if (draft.compareAtPricePaisa !== basis.compareAtPricePaisa)
    out.compareAtPricePaisa = draft.compareAtPricePaisa ?? null;
  if (draft.costPricePaisa !== basis.costPricePaisa)
    out.costPricePaisa = draft.costPricePaisa ?? null;
  // isActive intentionally omitted — owned by PublishControl.
  if (draft.isReturnable !== basis.isReturnable) out.isReturnable = draft.isReturnable;
  if (draft.seoTitle !== basis.seoTitle) out.seoTitle = draft.seoTitle ?? null;
  if (draft.seoDescription !== basis.seoDescription)
    out.seoDescription = draft.seoDescription ?? null;
  if (draft.ogImageUrl !== basis.ogImageUrl) out.ogImageUrl = draft.ogImageUrl ?? null;
  if (!imagesEqual(draft.images, basis.images)) out.images = draft.images;
  return out;
}

function mergeProductChanges(
  prev: EditorProduct,
  changes: UpdateProductInput,
  target: EditorProduct,
): EditorProduct {
  // For each field present in `changes`, take the target's value (it's the
  // authoritative committed value). All other fields stay as `prev`.
  const next = { ...prev };
  if ('slug' in changes) next.slug = target.slug;
  if ('name' in changes) next.name = target.name;
  if ('description' in changes) next.description = target.description;
  if ('hsnCode' in changes) next.hsnCode = target.hsnCode;
  if ('gstRatePercent' in changes) next.gstRatePercent = target.gstRatePercent;
  if ('availabilityFlag' in changes) next.availabilityFlag = target.availabilityFlag;
  if ('basePricePaisa' in changes) next.basePricePaisa = target.basePricePaisa;
  if ('compareAtPricePaisa' in changes) next.compareAtPricePaisa = target.compareAtPricePaisa;
  if ('costPricePaisa' in changes) next.costPricePaisa = target.costPricePaisa;
  if ('isReturnable' in changes) next.isReturnable = target.isReturnable;
  if ('seoTitle' in changes) next.seoTitle = target.seoTitle;
  if ('seoDescription' in changes) next.seoDescription = target.seoDescription;
  if ('ogImageUrl' in changes) next.ogImageUrl = target.ogImageUrl;
  if ('images' in changes) next.images = target.images;
  return next;
}

function hasNonCategoryDiff(a: EditorProduct, b: EditorProduct): boolean {
  return Object.keys(buildProductDiff(a, b)).length > 0;
}

function shallowEqualEditable(a: EditorProduct, b: EditorProduct): boolean {
  if (
    a.slug !== b.slug ||
    a.name !== b.name ||
    a.description !== b.description ||
    a.hsnCode !== b.hsnCode ||
    a.gstRatePercent !== b.gstRatePercent ||
    a.availabilityFlag !== b.availabilityFlag ||
    a.basePricePaisa !== b.basePricePaisa ||
    a.compareAtPricePaisa !== b.compareAtPricePaisa ||
    a.costPricePaisa !== b.costPricePaisa ||
    // isActive intentionally omitted — owned by PublishControl, not the SaveBar.
    a.isReturnable !== b.isReturnable ||
    a.seoTitle !== b.seoTitle ||
    a.seoDescription !== b.seoDescription ||
    a.ogImageUrl !== b.ogImageUrl
  ) {
    return false;
  }
  if (!imagesEqual(a.images, b.images)) return false;
  if (!arraysEqual(a.categoryIds, b.categoryIds)) return false;
  return true;
}

function imagesEqual(a: ProductImage[], b: ProductImage[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].url !== b[i].url || a[i].alt !== b[i].alt || a[i].sortOrder !== b[i].sortOrder)
      return false;
  }
  return true;
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

