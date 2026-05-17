'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { ProductImage, UpdateProductInput } from '@repo/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SaveBar } from '@/components/shell/save-bar';
import type { CategoryRow } from '../../categories/categories-client';
import { setProductCategoriesAction, updateProductAction } from './actions';
import { BasicsTab } from './tabs/basics-tab';
import { VariantsTab, type EditorVariant } from './tabs/variants-tab';
import { ImagesTab } from './tabs/images-tab';
import { CategoriesTab } from './tabs/categories-tab';
import { SeoTab } from './tabs/seo-tab';
import { GstTab } from './tabs/gst-tab';
import { AvailabilityTab } from './tabs/availability-tab';

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

// Single source of truth for the form state. Mutations are local; one Save button at the
// bottom diffs against `pristine` and pushes a single PATCH plus, when needed, a separate
// PUT for the categories assignment.
export function ProductEditor({ product, categoriesTree }: ProductEditorProps) {
  const router = useRouter();
  const [pristine, setPristine] = React.useState(product);
  const [draft, setDraft] = React.useState(product);
  const [saving, setSaving] = React.useState(false);

  // Reset state when the server-side data changes (e.g. after router.refresh()).
  React.useEffect(() => {
    setPristine(product);
    setDraft(product);
  }, [product]);

  const dirty = React.useMemo(() => !shallowEqualEditable(draft, pristine), [draft, pristine]);

  function patch<K extends keyof EditorProduct>(key: K, value: EditorProduct[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Build the product PATCH payload from changed fields only — sending the full
      // record is fine, but limiting it makes log noise + error reporting cleaner.
      const productChanges: UpdateProductInput = {};
      if (draft.slug !== pristine.slug) productChanges.slug = draft.slug;
      if (draft.name !== pristine.name) productChanges.name = draft.name;
      if (draft.description !== pristine.description) productChanges.description = draft.description ?? null;
      if (draft.hsnCode !== pristine.hsnCode) productChanges.hsnCode = draft.hsnCode ?? null;
      if (draft.gstRatePercent !== pristine.gstRatePercent)
        productChanges.gstRatePercent = draft.gstRatePercent ?? null;
      if (draft.availabilityFlag !== pristine.availabilityFlag)
        productChanges.availabilityFlag = draft.availabilityFlag as UpdateProductInput['availabilityFlag'];
      if (draft.basePricePaisa !== pristine.basePricePaisa)
        productChanges.basePricePaisa = draft.basePricePaisa;
      if (draft.compareAtPricePaisa !== pristine.compareAtPricePaisa)
        productChanges.compareAtPricePaisa = draft.compareAtPricePaisa ?? null;
      if (draft.costPricePaisa !== pristine.costPricePaisa)
        productChanges.costPricePaisa = draft.costPricePaisa ?? null;
      if (draft.isActive !== pristine.isActive) productChanges.isActive = draft.isActive;
      if (draft.isReturnable !== pristine.isReturnable) productChanges.isReturnable = draft.isReturnable;
      if (draft.seoTitle !== pristine.seoTitle) productChanges.seoTitle = draft.seoTitle ?? null;
      if (draft.seoDescription !== pristine.seoDescription)
        productChanges.seoDescription = draft.seoDescription ?? null;
      if (draft.ogImageUrl !== pristine.ogImageUrl) productChanges.ogImageUrl = draft.ogImageUrl ?? null;
      if (!imagesEqual(draft.images, pristine.images)) productChanges.images = draft.images;

      if (Object.keys(productChanges).length > 0) {
        const result = await updateProductAction(product.id, productChanges);
        if (!result.ok) {
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
          toast.error(result.error ?? 'Category update failed');
          return;
        }
      }

      toast.success('Product saved');
      setPristine(draft);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setDraft(pristine);
  }

  return (
    <div className="px-5 py-5 md:px-8 md:py-6">
      <Tabs defaultValue="basics">
        <TabsList className="mb-4 flex flex-wrap">
          <TabsTrigger value="basics">Basics</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="gst">GST</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
        </TabsList>
        <TabsContent value="basics">
          <BasicsTab draft={draft} patch={patch} />
        </TabsContent>
        <TabsContent value="variants">
          <VariantsTab productId={product.id} variants={draft.variants} />
        </TabsContent>
        <TabsContent value="images">
          <ImagesTab
            images={draft.images}
            onChange={(images) => patch('images', images)}
          />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab
            tree={categoriesTree}
            value={draft.categoryIds}
            onChange={(categoryIds) => patch('categoryIds', categoryIds)}
          />
        </TabsContent>
        <TabsContent value="seo">
          <SeoTab draft={draft} patch={patch} />
        </TabsContent>
        <TabsContent value="gst">
          <GstTab draft={draft} patch={patch} />
        </TabsContent>
        <TabsContent value="availability">
          <AvailabilityTab draft={draft} patch={patch} />
        </TabsContent>
      </Tabs>
      <SaveBar dirty={dirty} saving={saving} onDiscard={handleDiscard} onSave={handleSave} />
    </div>
  );
}

// =====================================================
// Equality helpers — compare only the fields managed by the global save.
// =====================================================

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
    a.isActive !== b.isActive ||
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
