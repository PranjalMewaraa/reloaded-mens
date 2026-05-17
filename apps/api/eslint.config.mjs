import shared from '@repo/config/eslint';

export default [
  ...shared,
  // webpack.config.js is a CommonJS Node bootstrap script; it intentionally uses
  // `require` and `__dirname`. Don't lint it under the shared TS/ESM-oriented config.
  {
    ignores: ['webpack.config.js'],
  },
];
