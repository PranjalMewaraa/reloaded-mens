import Image from 'next/image';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { Pill } from '@/components/ui/pill';
import { formatINR } from '@/lib/utils';

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  basePricePaisa: number;
  compareAtPricePaisa: number | null;
  availabilityFlag: string;
  primaryImageUrl: string | null;
  primaryImageAlt: string;
  colors: string[];
  isLowStock: boolean;
  isOutOfStock: boolean;
  averageRating?: number | null;
  reviewCount?: number;
}

interface ProductCardProps {
  product: ProductCardData;
  // The category page wants images to fill the grid cell tightly; the home page rails
  // use the same component at a fixed width. `sizes` lets Next/Image pick the right
  // candidate without us thinking too hard about it.
  sizes?: string;
}

// MOOL product card per design system §"product card":
// - 3:4 portrait image, badge top-left, sold-out overlay when applicable
// - Title (13px font-medium), color count / fabric subtitle, price + MRP strikethrough
export function ProductCard({ product, sizes = '(min-width:768px) 25vw, 50vw' }: ProductCardProps) {
  const discountPct =
    product.compareAtPricePaisa && product.compareAtPricePaisa > product.basePricePaisa
      ? Math.round(
          ((product.compareAtPricePaisa - product.basePricePaisa) /
            product.compareAtPricePaisa) *
            100,
        )
      : null;

  const isInStoreOnly = product.availabilityFlag === 'in_store_only';

  return (
    <Link
      href={`/p/${product.slug}`}
      className="group flex flex-col"
      aria-label={product.name}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-ink-50">
        {product.primaryImageUrl ? (
          <Image
            src={product.primaryImageUrl}
            alt={product.primaryImageAlt}
            fill
            sizes={sizes}
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center font-mono text-[10.5px] uppercase tracking-caps text-ink-300">
            No image
          </div>
        )}
        <div className="absolute left-2.5 top-2.5 flex flex-col gap-1.5">
          {isInStoreOnly ? <Pill tone="moss">In-store only</Pill> : null}
          {discountPct ? <Pill tone="clay">−{discountPct}%</Pill> : null}
          {!isInStoreOnly && product.isLowStock && !product.isOutOfStock ? (
            <Pill tone="warning">Low stock</Pill>
          ) : null}
        </div>
        {product.isOutOfStock ? (
          <div className="absolute inset-0 flex items-center justify-center bg-snow/55">
            <Pill tone="snow">Sold out</Pill>
          </div>
        ) : null}
      </div>
      <div className="mt-2.5 flex flex-col gap-0.5">
        <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-ink-900">
          {product.name}
        </h3>
        <div className="flex items-center gap-2 text-[11.5px] text-ink-500">
          {product.colors.length > 0 ? (
            <span>
              {product.colors.length} colour{product.colors.length === 1 ? '' : 's'}
            </span>
          ) : null}
          {product.reviewCount && product.reviewCount > 0 ? (
            <span className="inline-flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-clay text-clay" />
              <span className="font-mono text-ink-900">
                {(product.averageRating ?? 0).toFixed(1)}
              </span>
              <span>· {product.reviewCount}</span>
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[13px] font-semibold text-ink-900">
            {formatINR(product.basePricePaisa)}
          </span>
          {product.compareAtPricePaisa &&
          product.compareAtPricePaisa > product.basePricePaisa ? (
            <>
              <span className="font-mono text-[11.5px] text-ink-400 line-through">
                {formatINR(product.compareAtPricePaisa)}
              </span>
              {discountPct ? (
                <span className="text-[11px] font-medium text-clay">−{discountPct}%</span>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
