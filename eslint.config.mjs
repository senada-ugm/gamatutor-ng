import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // content/*/assets holds course media and vendored builds (the 3D atlas),
  // not source.
  {
    ignores: ['out/**', 'fixtures/legacy/**', '**/dist/**', 'node_modules/**', 'content/*/assets/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
);
