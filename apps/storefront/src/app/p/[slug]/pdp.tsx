'use client';

// Client-rendered PDP body. Image gallery + variant pickers + delivery widget + sticky
// mobile add-to-cart all need to react to user input, so this single client component
// owns all the state. The Server Component parent passes the fetched product down so we
// don't double-fetch on hydration.

import * as React from 'react';
import Image from 'next/image';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { DeliveryWidget } from '@/components/pincode/delivery-widget';
import { useCart } from '@/lib/cart-context';
import { env } from '@/lib/env';
import { cn, formatINR } from '@/lib/utils';

interface PdpVariant {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  stockCount: number;
  priceOverridePaisa: number | null;
}

interface PdpProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  basePricePaisa: number;
  compareAtPricePaisa: number | null;
  availabilityFlag: string;
  isReturnable: boolean;
  images: Array<{ url: string; alt: string; sortOrder: number }>;
  variants: PdpVariant[];
}

interface PdpProps {
  product: PdpProduct;
}

export function Pdp({ product }: PdpProps) {
  const sortedImages = React.useMemo(
    () => [...product.images].sort((a, b) => a.sortOrder - b.sortOrder),
    [product.images],
  );
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const { addItem } = useCart();

  // Carousel scroll handling. We don't pull in embla / swiper — the native
  // CSS scroll-snap + scrollTo gives a clean swipe on mobile and arrow-button
  // navigation on desktop without any animation lib. The track only listens
  // to scroll events to keep the active dot/counter in sync; thumbnails and
  // prev/next buttons call scrollToIndex() directly.
  const trackRef = React.useRef<HTMLDivElement>(null);
  const scrollToIndex = React.useCallback((i: number) => {
    const c = trackRef.current;
    if (!c) return;
    c.scrollTo({ left: c.clientWidth * i, behavior: 'smooth' });
  }, []);
  const handleTrackScroll = React.useCallback(() => {
    const c = trackRef.current;
    if (!c || c.clientWidth === 0) return;
    const i = Math.round(c.scrollLeft / c.clientWidth);
    if (i !== activeImageIndex) setActiveImageIndex(i);
  }, [activeImageIndex]);

  // Variant selection. We pick the first in-stock variant by default so the price
  // displayed reflects something the customer can actually buy.
  const initialVariant =
    product.variants.find((v) => v.stockCount > 0) ?? product.variants[0] ?? null;
  const [selectedSize, setSelectedSize] = React.useState<string | null>(
    initialVariant?.size ?? null,
  );
  const [selectedColor, setSelectedColor] = React.useState<string | null>(
    initialVariant?.color ?? null,
  );

  const sizes = React.useMemo(
    () => Array.from(new Set(product.variants.map((v) => v.size).filter((s): s is string => Boolean(s)))),
    [product.variants],
  );
  const colors = React.useMemo(
    () => Array.from(new Set(product.variants.map((v) => v.color).filter((c): c is string => Boolean(c)))),
    [product.variants],
  );

  // Find the variant that matches the current size/color selection. If only one axis
  // exists, the other side falls through.
  const selectedVariant = React.useMemo(() => {
    return (
      product.variants.find(
        (v) =>
          (sizes.length === 0 || v.size === selectedSize) &&
          (colors.length === 0 || v.color === selectedColor),
      ) ?? null
    );
  }, [product.variants, sizes.length, colors.length, selectedSize, selectedColor]);

  const displayPricePaisa =
    selectedVariant?.priceOverridePaisa ?? product.basePricePaisa;
  const discountPct =
    product.compareAtPricePaisa && product.compareAtPricePaisa > displayPricePaisa
      ? Math.round(
          ((product.compareAtPricePaisa - displayPricePaisa) /
            product.compareAtPricePaisa) *
            100,
        )
      : null;

  const isInStoreOnly = product.availabilityFlag === 'in_store_only';
  const isOutOfStock =
    !selectedVariant || selectedVariant.stockCount <= 0 || !product.variants.some((v) => v.stockCount > 0);
  const isLowStock =
    selectedVariant && selectedVariant.stockCount > 0 && selectedVariant.stockCount <= 3;

  const whatsappHref = `https://wa.me/${env.NEXT_PUBLIC_WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
    `Hi! I'd like to book a fitting for "${product.name}".`,
  )}`;

  function handleAddToBag() {
    if (!selectedVariant) {
      toast.error('Pick a size and colour first');
      return;
    }
    if (selectedVariant.stockCount <= 0) {
      toast.error('That option is sold out');
      return;
    }
    const variantLabel = [selectedVariant.size, selectedVariant.color].filter(Boolean).join(' · ') || null;
    addItem({
      variantId: selectedVariant.id,
      productSlug: product.slug,
      productName: product.name,
      variantLabel,
      sku: selectedVariant.sku,
      primaryImageUrl: sortedImages[0]?.url ?? null,
      unitPricePaisa: displayPricePaisa,
    });
    toast.success(`Added to bag · ${variantLabel ?? product.name}`);
  }

  const hasMultipleImages = sortedImages.length > 1;
  const imageCount = sortedImages.length;

  return (
    <div className="grid gap-8 px-5 py-6 md:grid-cols-[7fr_5fr] md:gap-12 md:px-8 md:py-8">
      {/* Image gallery — two distinct layouts:
          - Mobile (<md): scroll-snap carousel (aspect-[3/4] portrait crop)
            with dot indicators + bottom thumbnail strip.
          - Desktop (≥md): magazine showcase — a big square featured image
            on the left, up to 3 thumbnails stacked vertically on the right.
            Clicking a thumbnail swaps it into the featured slot, and the
            previously-featured image takes its place in the thumb stack. */}
      <div>
        {/* MOBILE: carousel */}
        <div className="md:hidden">
          <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-ink-50">
            {imageCount === 0 ? (
              <div className="absolute inset-0 grid place-items-center font-mono text-[10.5px] uppercase tracking-caps text-ink-300">
                No image
              </div>
            ) : (
              <div
                ref={trackRef}
                onScroll={handleTrackScroll}
                className="scrollbar-hide flex h-full w-full snap-x snap-mandatory overflow-x-auto"
              >
                {sortedImages.map((img, idx) => (
                  <div
                    key={img.url}
                    className="relative h-full w-full shrink-0 snap-center snap-always"
                  >
                    <Image
                      src={img.url}
                      alt={img.alt || product.name}
                      fill
                      priority={idx === 0}
                      sizes="100vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}

            {imageCount > 0 ? (
              <div className="pointer-events-none absolute right-3 top-3">
                <Pill tone="snow">
                  {activeImageIndex + 1} / {imageCount}
                </Pill>
              </div>
            ) : null}

            {hasMultipleImages ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                {sortedImages.map((_, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      'h-1.5 rounded-full bg-snow transition-all',
                      idx === activeImageIndex ? 'w-5 opacity-100' : 'w-1.5 opacity-60',
                    )}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {hasMultipleImages ? (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {sortedImages.map((img, idx) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => scrollToIndex(idx)}
                  className={cn(
                    'relative aspect-square overflow-hidden rounded-md bg-ink-50 transition',
                    idx === activeImageIndex
                      ? 'ring-2 ring-ink-900 ring-offset-2 ring-offset-bone'
                      : 'opacity-70 hover:opacity-100',
                  )}
                  aria-label={`Image ${idx + 1}`}
                  aria-current={idx === activeImageIndex}
                >
                  <Image
                    src={img.url}
                    alt={img.alt || product.name}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* DESKTOP: magazine showcase. Featured image fills the left column,
            up to 3 thumbnails stack on the right. The featured = currently-
            active image, thumbnails = first 3 OTHER images in their original
            order. Click a thumb to make it featured (the previous featured
            slides into the thumb stack). */}
        <div className="hidden md:block">
          {imageCount === 0 ? (
            <div className="relative aspect-square overflow-hidden rounded-xl bg-ink-50">
              <div className="absolute inset-0 grid place-items-center font-mono text-[10.5px] uppercase tracking-caps text-ink-300">
                No image
              </div>
            </div>
          ) : imageCount === 1 ? (
            // Single image — no thumbnail column, just the featured shot.
            <div className="relative aspect-square overflow-hidden rounded-xl bg-ink-50">
              <Image
                src={sortedImages[0].url}
                alt={sortedImages[0].alt || product.name}
                fill
                priority
                sizes="(min-width:768px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
          ) : (
            <DesktopShowcase
              images={sortedImages}
              activeIndex={activeImageIndex}
              onSelect={(i) => {
                setActiveImageIndex(i);
                // Keep the hidden mobile carousel scroll in sync — no-op
                // while it's display:none, but if the viewport resizes the
                // carousel will already be at the right frame.
                scrollToIndex(i);
              }}
              productName={product.name}
            />
          )}
        </div>
      </div>

      {/* Details */}
      <div className="flex flex-col gap-5 pb-24 md:pb-0">
        <div>
          <div className="flex items-center gap-2">
            {isInStoreOnly ? <Pill tone="moss">In-store only</Pill> : null}
            {isLowStock ? <Pill tone="warning">Low stock</Pill> : null}
            {isOutOfStock ? <Pill tone="danger">Sold out</Pill> : null}
          </div>
          <h1 className="mt-2 font-display text-[28px] font-semibold tracking-tight text-ink-900 md:text-[34px]">
            {product.name}
          </h1>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="font-display text-[24px] font-semibold tracking-tight text-ink-900">
              {isInStoreOnly ? `From ${formatINR(displayPricePaisa)}` : formatINR(displayPricePaisa)}
            </span>
            {product.compareAtPricePaisa && product.compareAtPricePaisa > displayPricePaisa ? (
              <span className="font-mono text-[13px] text-ink-400 line-through">
                {formatINR(product.compareAtPricePaisa)}
              </span>
            ) : null}
            {discountPct ? (
              <span className="text-[13px] font-medium text-clay">−{discountPct}%</span>
            ) : null}
          </div>
          {isInStoreOnly ? (
            <p className="mt-1 text-[11.5px] text-ink-500">Final price set after fitting</p>
          ) : (
            <p className="mt-1 text-[11.5px] text-ink-500">Inclusive of all taxes</p>
          )}
        </div>

        {/* Color picker */}
        {colors.length > 0 ? (
          <div>
            <div className="label-caps mb-2">Colour</div>
            <div className="flex flex-wrap items-center gap-2.5">
              {colors.map((c) => {
                const swatch = colorSwatchFor(c);
                const isSelected = c === selectedColor;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className={cn(
                      'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px]',
                      isSelected
                        ? 'border-ink-900 bg-ink-50/60 text-ink-900'
                        : 'border-ink-200 text-ink-700 hover:border-ink-400',
                    )}
                  >
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full border border-ink-200"
                      style={{ backgroundColor: swatch }}
                      aria-hidden
                    />
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Size picker */}
        {sizes.length > 0 ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label-caps">Size</span>
              <a
                href="/size-guide"
                className="font-mono text-[11px] uppercase tracking-caps text-ink-500 underline-offset-2 hover:text-ink-900 hover:underline"
              >
                Size guide
              </a>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {sizes.map((s) => {
                const matchingVariant = product.variants.find(
                  (v) =>
                    v.size === s &&
                    (colors.length === 0 || v.color === selectedColor),
                );
                const oos = !matchingVariant || matchingVariant.stockCount <= 0;
                const low =
                  matchingVariant && matchingVariant.stockCount > 0 && matchingVariant.stockCount <= 3;
                const isSelected = s === selectedSize;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSize(s)}
                    className={cn(
                      'relative h-10 rounded-md border text-[12.5px] font-medium transition',
                      isSelected
                        ? 'border-ink-900 bg-ink-900 text-snow'
                        : oos
                          ? 'border-ink-100 bg-ink-50 text-ink-300 line-through'
                          : 'border-ink-200 bg-snow text-ink-900 hover:border-ink-900',
                    )}
                    disabled={oos}
                    aria-pressed={isSelected}
                  >
                    {s}
                    {low && !isSelected ? (
                      <span className="absolute -right-1.5 -top-1.5 rounded-full bg-warning px-1 text-[8px] font-medium leading-3 text-snow">
                        {matchingVariant!.stockCount} left
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Delivery widget — hidden for in-store only */}
        {!isInStoreOnly ? <DeliveryWidget /> : null}

        {/* CTA — desktop. Mobile sticky is rendered below the document flow. */}
        <div className="hidden md:block">
          {isInStoreOnly ? (
            <Button asChild variant="whatsapp" size="lg" className="w-full">
              <a href={whatsappHref} target="_blank" rel="noopener">
                <MessageCircle className="mr-2 h-4 w-4" />
                Chat to book a fitting
              </a>
            </Button>
          ) : (
            <Button
              size="lg"
              variant="clay"
              className="w-full"
              onClick={handleAddToBag}
              disabled={isOutOfStock}
            >
              {isOutOfStock ? 'Sold out' : `Add to bag · ${formatINR(displayPricePaisa)}`}
            </Button>
          )}
        </div>

        {/* Description */}
        {product.description ? (
          <div className="mt-2">
            <div className="label-caps mb-2">About this piece</div>
            <p className="whitespace-pre-line text-[14px] leading-[1.7] text-ink-700">
              {product.description}
            </p>
          </div>
        ) : null}

        {!isInStoreOnly && product.isReturnable ? (
          <p className="text-[12px] text-ink-500">
            <span className="font-medium text-ink-700">14-day returns.</span> Try it on at home —
            if it doesn&apos;t fit, send it back free.
          </p>
        ) : null}
      </div>

      {/* Sticky mobile CTA */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-ink-100 bg-snow px-5 py-3 md:hidden">
        <div className="flex items-center gap-3">
          <div className="flex flex-col leading-tight">
            <span className="font-display text-[18px] font-semibold text-ink-900">
              {isInStoreOnly ? `From ${formatINR(displayPricePaisa)}` : formatINR(displayPricePaisa)}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-caps text-ink-500">
              {[selectedSize, selectedColor].filter(Boolean).join(' · ') || 'Select options'}
            </span>
          </div>
          {isInStoreOnly ? (
            <Button asChild variant="whatsapp" size="md" className="flex-1">
              <a href={whatsappHref} target="_blank" rel="noopener">
                <MessageCircle className="mr-1.5 h-4 w-4" />
                Chat to book
              </a>
            </Button>
          ) : (
            <Button
              size="md"
              variant="clay"
              className="flex-1"
              onClick={handleAddToBag}
              disabled={isOutOfStock}
            >
              {isOutOfStock ? 'Sold out' : 'Add to bag'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Magazine-style PDP gallery on desktop. Featured (active) image on the left
// fills its column at aspect-square; up to 3 thumbnails stack on the right
// in original-index order, excluding whichever is currently featured.
//
// Container aspect-[3/2] + grid-cols-[2fr_1fr] + auto-rows that divide the
// container height evenly produces a left cell that's ~square (col is 2/3
// of width, container is 2/3 of height ratio → cell is 1:1) and right cells
// that are wider-than-tall rectangles. Tweak the container aspect if the
// thumbs feel too short/tall.
//
// If the product has 5+ images, only the first 3 non-active appear here —
// cycling through thumbs surfaces the others over time. Add an explicit
// "+N more" lightbox affordance if the catalogue starts shipping > 4 photos
// per product routinely.
interface DesktopShowcaseProps {
  images: Array<{ url: string; alt: string; sortOrder: number }>;
  activeIndex: number;
  onSelect: (index: number) => void;
  productName: string;
}

function DesktopShowcase({ images, activeIndex, onSelect, productName }: DesktopShowcaseProps) {
  const thumbIndices = images
    .map((_, i) => i)
    .filter((i) => i !== activeIndex)
    .slice(0, 3);
  const active = images[activeIndex] ?? images[0];

  return (
    <div
      className="grid aspect-[3/2] gap-2 md:grid-cols-[2fr_1fr] md:gap-3"
      style={{
        gridTemplateRows: `repeat(${Math.max(thumbIndices.length, 1)}, minmax(0, 1fr))`,
      }}
    >
      {/* Featured — spans every row of the right column visually. */}
      <div
        className="relative overflow-hidden rounded-xl bg-ink-50"
        style={{ gridRow: '1 / -1' }}
      >
        <Image
          src={active.url}
          alt={active.alt || productName}
          fill
          priority
          sizes="(min-width:768px) 30vw, 100vw"
          className="object-cover"
        />
      </div>
      {/* Right column thumbnails — click to swap into featured slot. */}
      {thumbIndices.map((i) => (
        <button
          key={images[i].url}
          type="button"
          onClick={() => onSelect(i)}
          className="relative overflow-hidden rounded-md bg-ink-50 transition hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
          aria-label={`Show image ${i + 1} of ${images.length}`}
        >
          <Image
            src={images[i].url}
            alt={images[i].alt || productName}
            fill
            sizes="(min-width:768px) 15vw, 50vw"
            className="object-cover"
          />
        </button>
      ))}
    </div>
  );
}

// Inline color swatch mapping — keeps the storefront self-contained. New custom colors
// fall back to a neutral grey until we add a per-color hex in the admin (Sprint 6+).
function colorSwatchFor(name: string): string {
  const key = name.toLowerCase();
  const known: Record<string, string> = {
    black: '#0A0A0A',
    white: '#FFFFFF',
    natural: '#E8E2D2',
    grey: '#9CA3AF',
    gray: '#9CA3AF',
    navy: '#1E3A8A',
    blue: '#2563EB',
    olive: '#556B2F',
    moss: '#2D5A43',
    clay: '#FF5B00',
    red: '#DC2626',
    green: '#16A34A',
    brown: '#7C5A39',
    beige: '#E8D7B7',
  };
  return known[key] ?? '#D1D5DB';
}
