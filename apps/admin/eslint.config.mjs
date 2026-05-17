import shared from '@repo/config/eslint';

export default [
  ...shared,
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
];
