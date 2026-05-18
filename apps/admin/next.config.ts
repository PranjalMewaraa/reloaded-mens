import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import type { NextConfig } from 'next';

// Load DATABASE_URL etc. from the monorepo root .env at config-eval time. The
// admin reads Prisma directly in Server Components (the dashboard order counts),
// and Next.js doesn't traverse parent directories for env files on its own.
// In Docker builds the .env file isn't in the build context — dotenv silently
// no-ops on missing file, which is fine because the runtime env arrives via
// process.env from docker-compose env_file. Locally this loads dev secrets.
loadDotenv({ path: path.resolve(__dirname, '../../.env') });

const config: NextConfig = {
  reactStrictMode: true,
  // Sprint 9 deploy — `standalone` emits `.next/standalone/server.js` plus a
  // minimal pruned node_modules tree. `outputFileTracingRoot` is required in
  // a monorepo so Next pulls workspace deps from the repo root.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@repo/ui', '@repo/types', '@repo/db'],
  // Workspace packages use Node-ESM '.js' import specifiers (required for the API runtime).
  // Webpack needs an explicit alias to map '.js' back to '.ts'/'.tsx' source files.
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.js', '.ts', '.tsx'],
    };
    return config;
  },
};

export default config;
