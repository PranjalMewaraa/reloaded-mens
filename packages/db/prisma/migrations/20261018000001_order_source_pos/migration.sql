-- Add POS support to Order table
-- source: 'storefront' | 'pos' — where the order originated
ALTER TABLE "Order" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'storefront';
-- billPdfUrl: URL to the generated PDF bill (POS orders only)
ALTER TABLE "Order" ADD COLUMN "billPdfUrl" TEXT;
