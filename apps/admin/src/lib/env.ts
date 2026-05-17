// Validated env loader for the admin app.
// Read once at module load — fails fast on missing required vars.

import { z } from 'zod';

const schema = z.object({
  // Server-only — the API base URL the admin's server components hit.
  // NEXT_PUBLIC_ADMIN_API_URL is what's wired today; keep it as the source.
  NEXT_PUBLIC_ADMIN_API_URL: z
    .string()
    .url()
    .default('http://localhost:4000'),
  NEXT_PUBLIC_ADMIN_URL: z.string().url().default('http://localhost:3001'),
});

export const env = schema.parse({
  NEXT_PUBLIC_ADMIN_API_URL: process.env.NEXT_PUBLIC_ADMIN_API_URL,
  NEXT_PUBLIC_ADMIN_URL: process.env.NEXT_PUBLIC_ADMIN_URL,
});

// The API mounts everything under /api/v1.
export const API_BASE = `${env.NEXT_PUBLIC_ADMIN_API_URL}/api/v1`;
