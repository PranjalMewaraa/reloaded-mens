// Webpack config for the NestJS API.
//
// Why webpack: workspace packages (@repo/db, @repo/types, @repo/ui) export TS source
// directly. NestJS's default tsc compiler doesn't traverse them — at runtime Node would
// try to load the .ts files and fail to resolve their .js-suffixed imports. Webpack
// bundles everything (including the workspace TS) into a single dist/main.js using
// ts-loader, then we externalize npm dependencies via nodeExternals.

const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = (options, _webpack) => {
  return {
    ...options,
    entry: ['./src/main.ts'],
    target: 'node',
    externals: [
      nodeExternals({
        // Bundle workspace packages instead of externalizing them.
        allowlist: [/^@repo\//],
      }),
    ],
    output: {
      ...options.output,
      filename: 'main.js',
      path: path.resolve(__dirname, 'dist'),
    },
    resolve: {
      ...options.resolve,
      extensions: ['.ts', '.tsx', '.js', '.json'],
      // Map .js specifiers back to .ts/.tsx source. Workspace packages (@repo/types,
      // @repo/ui) use Node-ESM '.js' imports for runtime correctness; the email module
      // also has React Email .tsx templates imported via `.js` suffix.
      extensionAlias: {
        '.js': ['.js', '.ts', '.tsx'],
        '.cjs': ['.cjs', '.cts'],
        '.mjs': ['.mjs', '.mts'],
      },
    },
  };
};
