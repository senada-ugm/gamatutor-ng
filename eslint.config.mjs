import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // content/*/assets holds course media, not source.
  {
    ignores: [
      'out/**',
      'fixtures/legacy/**',
      '**/dist/**',
      '**/node_modules/**',
      'content/*/assets/**',
      'apps/web/.next/**',
      'apps/web/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
);
