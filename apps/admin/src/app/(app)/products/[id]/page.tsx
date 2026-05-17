import { notFound } from 'next/navigation';
import type { ProductImage } from '@repo/types';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { ProductEditor, type EditorProduct, type EditorVariant } from './product-editor';
import type { CategoryRow } from '../../categories/categories-client';

export const metadata = { title: 'Product editor' };

interface ProductGetResponse {
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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductEditorPage({ params }: PageProps) {
  const { id } = await params;
  const [productRes, categoriesRes] = await Promise.all([
    api<ProductGetResponse>(`/products/${id}`),
    api<{ items: CategoryRow[] }>('/categories'),
  ]);
  if (!productRes.ok || !productRes.body) notFound();

  const product: EditorProduct = {
    id: productRes.body.id,
    slug: productRes.body.slug,
    name: productRes.body.name,
    description: productRes.body.description,
    hsnCode: productRes.body.hsnCode,
    gstRatePercent: productRes.body.gstRatePercent,
    availabilityFlag: productRes.body.availabilityFlag,
    basePricePaisa: productRes.body.basePricePaisa,
    compareAtPricePaisa: productRes.body.compareAtPricePaisa,
    costPricePaisa: productRes.body.costPricePaisa,
    isActive: productRes.body.isActive,
    isReturnable: productRes.body.isReturnable,
    images: productRes.body.images,
    seoTitle: productRes.body.seoTitle,
    seoDescription: productRes.body.seoDescription,
    ogImageUrl: productRes.body.ogImageUrl,
    variants: productRes.body.variants,
    categoryIds: productRes.body.categoryIds,
  };
  const categoriesTree =
    categoriesRes.ok && categoriesRes.body ? categoriesRes.body.items : [];

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader
        breadcrumbs={[
          { label: 'Catalogue' },
          { label: 'Products', href: '/products' },
          { label: product.name },
        ]}
        title={product.name}
        description={`/${product.slug}`}
      />
      <ProductEditor product={product} categoriesTree={categoriesTree} />
    </div>
  );
}
