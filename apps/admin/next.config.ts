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
  // Prisma's query-engine is a `.so.node` native binary that Next's file
  // tracer drops from the standalone output (it follows `require` calls,
  // not the runtime engine-binary lookup). Two-pronged fix:
  //
  //   1. `serverExternalPackages` tells Next to leave @prisma/client as a
  //      runtime require() instead of bundling it. Without this the client
  //      gets webpacked into a server chunk and its sibling-file engine
  //      lookup breaks.
  //
  //   2. `outputFileTracingIncludes` forces the tracer to copy the engine
  //      binary + generated client into .next/standalone. pnpm puts these
  //      under .pnpm/@prisma+client@<hash>/node_modules/... — the glob
  //      matches whatever version-hash pnpm picked.
  //
  // Belt-and-suspenders: the Dockerfile also copies the engine binary
  // explicitly from the builder's pnpm store into the runner image (the
  // tracer has been known to skip .node files even with this config).
  // https://pris.ly/d/engine-not-found-nextjs
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
  outputFileTracingIncludes: {
    '/**/*': [
      './node_modules/.prisma/client/**/*',
      './node_modules/@prisma/client/**/*',
      './node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**/*',
      './node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/**/*',
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
