import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Sprint 9 deploy — `standalone` emits `.next/standalone/server.js` plus a
  // minimal pruned node_modules tree, which is what the production Docker
  // image runs. `outputFileTracingRoot` is required in a monorepo so Next
  // pulls workspace deps up from the repo root (otherwise it traces only
  // inside apps/storefront/ and misses @repo/* sources).
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@repo/ui', '@repo/types'],
  images: {
    // Product + category images are uploaded to the API and served via
    // @nestjs/serve-static at /files/*. PUBLIC_API_URL (api.reloadedmens.in
    // in prod, localhost in dev) determines which host appears in the URL —
    // both must be allow-listed here or next/image returns 400 from the
    // /_next/image optimizer endpoint. Add R2 / CDN hosts here once they
    // land in Phase 2.
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '4000', pathname: '/files/**' },
      { protocol: 'http', hostname: '127.0.0.1', port: '4000', pathname: '/files/**' },
      { protocol: 'https', hostname: 'api.reloadedmens.in', pathname: '/files/**' },
      // Picsum placeholders used by the dev seed. Remove once real product photos are uploaded.
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'fastly.picsum.photos', pathname: '/**' },
    ],
  },
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
