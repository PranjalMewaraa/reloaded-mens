import { z } from 'zod';

// Storefront env. Public vars are inlined by Next.js at build time so they're safe
// to read on both server and client.
const schema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  NEXT_PUBLIC_STOREFRONT_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_BRAND_NAME: z.string().default('Reloaded'),
  NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().default('+919999999999'),
});

export const env = schema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_STOREFRONT_URL: process.env.NEXT_PUBLIC_STOREFRONT_URL,
  NEXT_PUBLIC_BRAND_NAME: process.env.NEXT_PUBLIC_BRAND_NAME,
  NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
});

// The API mounts everything under /api/v1. Public catalog routes are at /api/v1/public/*.
export const API_BASE = `${env.NEXT_PUBLIC_API_URL}/api/v1`;
