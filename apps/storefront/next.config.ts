import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@repo/ui', '@repo/types'],
  images: {
    // Local product images are uploaded to the API and served via @nestjs/serve-static
    // at /files/*. In production this will be R2 / a CDN host — add those here too.
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '4000', pathname: '/files/**' },
      { protocol: 'http', hostname: '127.0.0.1', port: '4000', pathname: '/files/**' },
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
