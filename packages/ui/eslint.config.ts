import { tanstackConfig } from "@tanstack/eslint-config"

/**
 * src/components is shadcn-owned registry output (`shadcn add
 * --overwrite` regenerates it at any time) — never hand-edited, never
 * linted. Authored shared UI goes in src/composed instead; hooks/lib/
 * styles are ours and stay linted. See README.md. Rule tuning matches
 * the reference start-monorepo configs.
 */
export default [
  {
    ignores: ["src/components/**"],
  },
  ...tanstackConfig,
  {
    rules: {
      "import/no-cycle": "off",
      "import/order": "off",
      "sort-imports": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/require-await": "off",
      "pnpm/json-enforce-catalog": "off",
    },
  },
]
