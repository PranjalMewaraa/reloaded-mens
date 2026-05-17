// Seed script for local development.
// Run with: pnpm db:seed
// Idempotent — `upsert(... update: {})` so re-runs never overwrite admin-edited data.

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEED_ADMIN_EMAIL = 'admin@example.com';
const SEED_ADMIN_PASSWORD = 'changeme';
const BCRYPT_COST = 12;

interface SeedCategory {
  slug: string;
  name: string;
  description?: string;
  parentSlug?: string;
  sortOrder?: number;
}

const CATEGORIES: SeedCategory[] = [
  { slug: 'shirts', name: 'Shirts', description: 'Everyday shirts in linen, cotton, and oxford weaves.', sortOrder: 1 },
  { slug: 'casual-shirts', name: 'Casual', parentSlug: 'shirts', sortOrder: 1 },
  { slug: 'linen-shirts', name: 'Linen', parentSlug: 'shirts', sortOrder: 2 },
  { slug: 'trousers', name: 'Trousers', description: 'Heavy cottons, lightweight linens, pleats included.', sortOrder: 2 },
  { slug: 'knitwear', name: 'Knitwear', description: 'Merino, lambswool, and cotton knits for layered days.', sortOrder: 3 },
  { slug: 'indianwear', name: 'Indianwear', description: 'Kurtas and short-coats, in-store fittings only.', sortOrder: 4 },
  { slug: 'sale', name: 'Sale', description: 'End-of-season pricing — limited stock.', sortOrder: 5 },
];

interface SeedProduct {
  slug: string;
  name: string;
  description: string;
  basePricePaisa: number;
  compareAtPricePaisa?: number;
  hsnCode: string;
  gstRatePercent: number;
  availabilityFlag?: 'online_shippable' | 'in_store_only' | 'both';
  categorySlugs: string[];
  imageSeeds: string[];
  variants: Array<{
    sku: string;
    size?: string;
    color?: string;
    stockCount: number;
    lowStockThreshold?: number;
  }>;
}

const PRODUCTS: SeedProduct[] = [
  {
    slug: 'mool-camp-shirt',
    name: 'Reloaded Camp Shirt',
    description:
      'A short-sleeve resort shirt in a slubby cotton-linen blend. Boxy through the body, cropped at the hip, with a flat camp collar that sits naturally open. Pairs equally well over a tee or buttoned to the top.',
    basePricePaisa: 199900,
    hsnCode: '6105',
    gstRatePercent: 12,
    categorySlugs: ['shirts', 'casual-shirts'],
    imageSeeds: ['mool-camp-shirt-1', 'mool-camp-shirt-2', 'mool-camp-shirt-3', 'mool-camp-shirt-4'],
    variants: [
      { sku: 'MOOL-CAMP-S-NATURAL', size: 'S', color: 'Natural', stockCount: 8 },
      { sku: 'MOOL-CAMP-M-NATURAL', size: 'M', color: 'Natural', stockCount: 12 },
      { sku: 'MOOL-CAMP-L-NATURAL', size: 'L', color: 'Natural', stockCount: 6 },
      { sku: 'MOOL-CAMP-S-BLACK', size: 'S', color: 'Black', stockCount: 2, lowStockThreshold: 3 },
      { sku: 'MOOL-CAMP-M-BLACK', size: 'M', color: 'Black', stockCount: 0 },
      { sku: 'MOOL-CAMP-L-BLACK', size: 'L', color: 'Black', stockCount: 10 },
    ],
  },
  {
    slug: 'linen-cuban-shirt',
    name: 'Linen Cuban Shirt',
    description:
      'Full-length linen shirt with a soft Cuban collar and contrast piping at the placket. Pure flax linen, garment-washed for a lived-in hand from the first wear.',
    basePricePaisa: 249900,
    hsnCode: '6105',
    gstRatePercent: 12,
    categorySlugs: ['shirts', 'linen-shirts'],
    imageSeeds: ['linen-cuban-1', 'linen-cuban-2', 'linen-cuban-3'],
    variants: [
      { sku: 'MOOL-CUBAN-S-OLIVE', size: 'S', color: 'Olive', stockCount: 5 },
      { sku: 'MOOL-CUBAN-M-OLIVE', size: 'M', color: 'Olive', stockCount: 9 },
      { sku: 'MOOL-CUBAN-L-OLIVE', size: 'L', color: 'Olive', stockCount: 7 },
      { sku: 'MOOL-CUBAN-XL-OLIVE', size: 'XL', color: 'Olive', stockCount: 3, lowStockThreshold: 4 },
      { sku: 'MOOL-CUBAN-S-WHITE', size: 'S', color: 'White', stockCount: 14 },
      { sku: 'MOOL-CUBAN-M-WHITE', size: 'M', color: 'White', stockCount: 11 },
      { sku: 'MOOL-CUBAN-L-WHITE', size: 'L', color: 'White', stockCount: 8 },
      { sku: 'MOOL-CUBAN-XL-WHITE', size: 'XL', color: 'White', stockCount: 4 },
    ],
  },
  {
    slug: 'indigo-oxford-shirt',
    name: 'Indigo Oxford Shirt',
    description:
      'Classic button-down in a heavy 8oz oxford. Yarn-dyed indigo that softens beautifully with each wash. A workhorse — tucked, untucked, or under a knit.',
    basePricePaisa: 179900,
    hsnCode: '6105',
    gstRatePercent: 12,
    categorySlugs: ['shirts', 'casual-shirts'],
    imageSeeds: ['indigo-oxford-1', 'indigo-oxford-2', 'indigo-oxford-3'],
    variants: [
      { sku: 'MOOL-OXFORD-S-INDIGO', size: 'S', color: 'Indigo', stockCount: 10 },
      { sku: 'MOOL-OXFORD-M-INDIGO', size: 'M', color: 'Indigo', stockCount: 15 },
      { sku: 'MOOL-OXFORD-L-INDIGO', size: 'L', color: 'Indigo', stockCount: 12 },
      { sku: 'MOOL-OXFORD-XL-INDIGO', size: 'XL', color: 'Indigo', stockCount: 7 },
      { sku: 'MOOL-OXFORD-XXL-INDIGO', size: 'XXL', color: 'Indigo', stockCount: 3, lowStockThreshold: 4 },
    ],
  },
  {
    slug: 'heavy-cotton-trouser',
    name: 'Heavy Cotton Trouser',
    description:
      'A flat-front trouser cut in a 14oz cotton twill. Tapers gently from a regular thigh. Sits at the natural waist with a hidden hook-and-bar closure.',
    basePricePaisa: 229900,
    hsnCode: '6203',
    gstRatePercent: 12,
    categorySlugs: ['trousers'],
    imageSeeds: ['heavy-cotton-1', 'heavy-cotton-2', 'heavy-cotton-3', 'heavy-cotton-4'],
    variants: [
      { sku: 'MOOL-HCT-30-OLIVE', size: '30', color: 'Olive', stockCount: 6 },
      { sku: 'MOOL-HCT-32-OLIVE', size: '32', color: 'Olive', stockCount: 11 },
      { sku: 'MOOL-HCT-34-OLIVE', size: '34', color: 'Olive', stockCount: 9 },
      { sku: 'MOOL-HCT-36-OLIVE', size: '36', color: 'Olive', stockCount: 4 },
      { sku: 'MOOL-HCT-30-BROWN', size: '30', color: 'Brown', stockCount: 5 },
      { sku: 'MOOL-HCT-32-BROWN', size: '32', color: 'Brown', stockCount: 8 },
      { sku: 'MOOL-HCT-34-BROWN', size: '34', color: 'Brown', stockCount: 7 },
      { sku: 'MOOL-HCT-36-BROWN', size: '36', color: 'Brown', stockCount: 2, lowStockThreshold: 3 },
    ],
  },
  {
    slug: 'pleated-linen-pant',
    name: 'Pleated Linen Pant',
    description:
      'Double-pleat linen pant with a generous leg and a turn-up hem. Lightweight enough for a Bengaluru summer; structured enough to dress up.',
    basePricePaisa: 279900,
    hsnCode: '6203',
    gstRatePercent: 12,
    categorySlugs: ['trousers'],
    imageSeeds: ['pleated-linen-1', 'pleated-linen-2'],
    variants: [
      { sku: 'MOOL-PLP-30-NATURAL', size: '30', color: 'Natural', stockCount: 4 },
      { sku: 'MOOL-PLP-32-NATURAL', size: '32', color: 'Natural', stockCount: 8 },
      { sku: 'MOOL-PLP-34-NATURAL', size: '34', color: 'Natural', stockCount: 6 },
      { sku: 'MOOL-PLP-36-NATURAL', size: '36', color: 'Natural', stockCount: 3, lowStockThreshold: 3 },
    ],
  },
  {
    slug: 'merino-crew-knit',
    name: 'Merino Crew Knit',
    description:
      'A fine-gauge merino crew with ribbed cuffs and a clean rolled hem. Lightweight enough to layer under a shirt; warm enough on its own.',
    basePricePaisa: 349900,
    hsnCode: '6110',
    gstRatePercent: 12,
    categorySlugs: ['knitwear'],
    imageSeeds: ['merino-crew-1', 'merino-crew-2', 'merino-crew-3'],
    variants: [
      { sku: 'MOOL-MERINO-S-CHARCOAL', size: 'S', color: 'Charcoal', stockCount: 5 },
      { sku: 'MOOL-MERINO-M-CHARCOAL', size: 'M', color: 'Charcoal', stockCount: 9 },
      { sku: 'MOOL-MERINO-L-CHARCOAL', size: 'L', color: 'Charcoal', stockCount: 7 },
      { sku: 'MOOL-MERINO-XL-CHARCOAL', size: 'XL', color: 'Charcoal', stockCount: 3, lowStockThreshold: 3 },
      { sku: 'MOOL-MERINO-S-NAVY', size: 'S', color: 'Navy', stockCount: 8 },
      { sku: 'MOOL-MERINO-M-NAVY', size: 'M', color: 'Navy', stockCount: 10 },
      { sku: 'MOOL-MERINO-L-NAVY', size: 'L', color: 'Navy', stockCount: 6 },
      { sku: 'MOOL-MERINO-XL-NAVY', size: 'XL', color: 'Navy', stockCount: 4 },
    ],
  },
  {
    slug: 'lambswool-cardigan',
    name: 'Lambswool Cardigan',
    description:
      'A heavy lambswool cardigan with horn buttons and patch pockets. Knit in Ludhiana from British lambswool yarn — soft straight off the needle.',
    basePricePaisa: 399900,
    hsnCode: '6110',
    gstRatePercent: 12,
    categorySlugs: ['knitwear'],
    imageSeeds: ['lambswool-1', 'lambswool-2', 'lambswool-3'],
    variants: [
      { sku: 'MOOL-LAMB-S-CAMEL', size: 'S', color: 'Camel', stockCount: 3, lowStockThreshold: 3 },
      { sku: 'MOOL-LAMB-M-CAMEL', size: 'M', color: 'Camel', stockCount: 6 },
      { sku: 'MOOL-LAMB-L-CAMEL', size: 'L', color: 'Camel', stockCount: 5 },
      { sku: 'MOOL-LAMB-XL-CAMEL', size: 'XL', color: 'Camel', stockCount: 2, lowStockThreshold: 3 },
    ],
  },
  {
    slug: 'cotton-mul-kurta',
    name: 'Cotton Mul Kurta',
    description:
      'A hand-block printed kurta in mul cotton, finished with mother-of-pearl buttons. Made-to-measure in our Bengaluru store. Book a fitting on WhatsApp to choose the print and fit.',
    basePricePaisa: 189900,
    hsnCode: '6103',
    gstRatePercent: 12,
    availabilityFlag: 'in_store_only',
    categorySlugs: ['indianwear'],
    imageSeeds: ['mul-kurta-1', 'mul-kurta-2', 'mul-kurta-3'],
    variants: [
      { sku: 'MOOL-MUL-S-NATURAL', size: 'S', color: 'Natural', stockCount: 4 },
      { sku: 'MOOL-MUL-M-NATURAL', size: 'M', color: 'Natural', stockCount: 6 },
      { sku: 'MOOL-MUL-L-NATURAL', size: 'L', color: 'Natural', stockCount: 3 },
    ],
  },
  {
    slug: 'linen-pocket-tee',
    name: 'Linen Pocket Tee',
    description:
      'A heavyweight linen tee with a patch chest pocket and a relaxed boxy fit. End-of-season pricing — limited sizes left.',
    basePricePaisa: 99900,
    compareAtPricePaisa: 149900,
    hsnCode: '6109',
    gstRatePercent: 12,
    categorySlugs: ['sale'],
    imageSeeds: ['linen-tee-1', 'linen-tee-2'],
    variants: [
      { sku: 'MOOL-LTEE-S-NATURAL', size: 'S', color: 'Natural', stockCount: 4 },
      { sku: 'MOOL-LTEE-M-NATURAL', size: 'M', color: 'Natural', stockCount: 0 },
      { sku: 'MOOL-LTEE-L-NATURAL', size: 'L', color: 'Natural', stockCount: 2, lowStockThreshold: 3 },
      { sku: 'MOOL-LTEE-XL-NATURAL', size: 'XL', color: 'Natural', stockCount: 0 },
      { sku: 'MOOL-LTEE-S-BLACK', size: 'S', color: 'Black', stockCount: 3, lowStockThreshold: 3 },
      { sku: 'MOOL-LTEE-M-BLACK', size: 'M', color: 'Black', stockCount: 5 },
      { sku: 'MOOL-LTEE-L-BLACK', size: 'L', color: 'Black', stockCount: 1, lowStockThreshold: 3 },
      { sku: 'MOOL-LTEE-XL-BLACK', size: 'XL', color: 'Black', stockCount: 0 },
    ],
  },
];

// 3:4 portrait at 800×1067 — matches the storefront product card aspect.
function picsumUrl(seed: string, w = 800, h = 1067): string {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

async function main() {
  console.log('Seeding database...');

  // -------- Admin user --------
  const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, BCRYPT_COST);
  const admin = await prisma.adminUser.upsert({
    where: { email: SEED_ADMIN_EMAIL },
    update: { passwordHash },
    create: {
      email: SEED_ADMIN_EMAIL,
      passwordHash,
      name: 'Store Admin',
      role: 'admin',
      isActive: true,
    },
  });
  console.log(`  Admin user: ${admin.email}`);

  // -------- Settings --------
  const settings: Array<[string, unknown]> = [
    ['shipping.free_threshold_paisa', 199900],
    ['shipping.flat_fee_paisa', 9900],
    ['returns.window_days', 7],
    ['returns.replacement_keep_threshold_paisa', 50000],
    ['inventory.low_stock_default_threshold', 3],
    ['business.legal_name', 'Menswear Store Pvt Ltd'],
    ['business.gstin', '00AAAAA0000A1Z5'],
    ['business.store_address', '123 Main Street, City, State 110001'],
    ['business.whatsapp_number', '+919999999999'],
    // Sprint 3 — pincode serviceability allowlist consumed by GET /public/serviceability.
    // Update via Prisma Studio until the admin UI lands (Sprint 9 polish).
    [
      'serviceable_pincodes',
      { prefixes: ['56', '110', '400', '600', '700', '500', '380', '411'], exact: [] },
    ],
  ];
  for (const [key, value] of settings) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: value as never },
    });
  }
  console.log(`  Settings: ${settings.length} rows`);

  // -------- Categories --------
  // Two-pass create so child categories can resolve their parentId. We `upsert(... update: {})`
  // so re-runs are no-ops if admin has edited the row.
  const categoryIdBySlug = new Map<string, string>();

  for (const cat of CATEGORIES.filter((c) => !c.parentSlug)) {
    const row = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        slug: cat.slug,
        name: cat.name,
        description: cat.description ?? null,
        sortOrder: cat.sortOrder ?? 0,
        isActive: true,
      },
    });
    categoryIdBySlug.set(cat.slug, row.id);
  }

  for (const cat of CATEGORIES.filter((c) => c.parentSlug)) {
    const parentId = categoryIdBySlug.get(cat.parentSlug!);
    if (!parentId) throw new Error(`Parent category not found: ${cat.parentSlug}`);
    const row = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        slug: cat.slug,
        name: cat.name,
        description: cat.description ?? null,
        parentId,
        sortOrder: cat.sortOrder ?? 0,
        isActive: true,
      },
    });
    categoryIdBySlug.set(cat.slug, row.id);
  }
  console.log(`  Categories: ${CATEGORIES.length} rows`);

  // -------- Products + variants + category joins + images --------
  for (const p of PRODUCTS) {
    const images = p.imageSeeds.map((seed, idx) => ({
      url: picsumUrl(seed),
      alt: `${p.name} — view ${idx + 1}`,
      sortOrder: idx,
    }));

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      // Re-running the seed refreshes name + description (so brand renames apply)
      // but leaves admin-edited fields like price, stock, and isActive alone.
      update: {
        name: p.name,
        description: p.description,
      },
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        hsnCode: p.hsnCode,
        gstRatePercent: p.gstRatePercent,
        availabilityFlag: p.availabilityFlag ?? 'online_shippable',
        basePricePaisa: p.basePricePaisa,
        compareAtPricePaisa: p.compareAtPricePaisa ?? null,
        isActive: true,
        isReturnable: p.availabilityFlag !== 'in_store_only',
        images: images as never,
      },
    });

    for (const v of p.variants) {
      await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {},
        create: {
          productId: product.id,
          sku: v.sku,
          size: v.size ?? null,
          color: v.color ?? null,
          stockCount: v.stockCount,
          lowStockThreshold: v.lowStockThreshold ?? 3,
          isActive: true,
        },
      });
    }

    for (const [idx, categorySlug] of p.categorySlugs.entries()) {
      const categoryId = categoryIdBySlug.get(categorySlug);
      if (!categoryId) {
        console.warn(`    Skipping unknown category "${categorySlug}" on product ${p.slug}`);
        continue;
      }
      await prisma.productCategory.upsert({
        where: { productId_categoryId: { productId: product.id, categoryId } },
        update: { sortOrder: idx },
        create: { productId: product.id, categoryId, sortOrder: idx },
      });
    }
  }
  const totalVariants = PRODUCTS.reduce((sum, p) => sum + p.variants.length, 0);
  console.log(`  Products: ${PRODUCTS.length} rows, ${totalVariants} variants`);

  // -------- Promotions + coupons (Sprint 7) --------
  // Reset every run so the dev DB stays in sync with this seed. Production data
  // never runs through the seed.
  await prisma.couponUsage.deleteMany({});
  await prisma.coupon.deleteMany({});
  await prisma.promotion.deleteMany({});

  const launchPromo = await prisma.promotion.create({
    data: {
      name: 'Launch week 10% off',
      description: 'Automatic order-wide discount above ₹1,999 for the first two weeks.',
      isAutomatic: true,
      isActive: true,
      stackable: false,
      stackPriority: 100,
      validFrom: null,
      validTo: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      conditions: [{ type: 'cart_subtotal_min', amountPaisa: 199900 }] as never,
      actions: [{ type: 'percent_off_order', percent: 10 }] as never,
    },
  });

  const welcomePromo = await prisma.promotion.create({
    data: {
      name: 'Welcome bonus',
      description: 'Coupon-gated ₹200 off for first-time customers.',
      isAutomatic: false,
      isActive: true,
      stackable: false,
      stackPriority: 50,
      conditions: [{ type: 'customer_first_time' }] as never,
      actions: [{ type: 'flat_off_order', amountPaisa: 20000 }] as never,
    },
  });
  await prisma.coupon.create({
    data: {
      code: 'WELCOME200',
      promotionId: welcomePromo.id,
      usageLimitTotal: 0,
      usageLimitPerCustomer: 1,
    },
  });

  // Bulk influencer drop — 50 single-use codes, 25% off.
  const influPromo = await prisma.promotion.create({
    data: {
      name: 'Influencer drop · 25% off',
      description: 'Single-use codes shared by collaborators.',
      isAutomatic: false,
      isActive: true,
      stackable: false,
      stackPriority: 30,
      conditions: [] as never,
      actions: [{ type: 'percent_off_order', percent: 25 }] as never,
    },
  });
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seenCodes = new Set<string>();
  const couponData: { code: string; promotionId: string; usageLimitTotal: number; usageLimitPerCustomer: number; batchLabel: string }[] = [];
  while (couponData.length < 50) {
    let body = '';
    for (let i = 0; i < 6; i++) body += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    const code = `INFLU${body}`;
    if (seenCodes.has(code)) continue;
    seenCodes.add(code);
    couponData.push({
      code,
      promotionId: influPromo.id,
      usageLimitTotal: 1,
      usageLimitPerCustomer: 1,
      batchLabel: 'launch-influencers',
    });
  }
  await prisma.coupon.createMany({ data: couponData });
  console.log(
    `  Promotions: 3 rows (${launchPromo.name}, ${welcomePromo.name}, ${influPromo.name}) + 51 coupons`,
  );

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
