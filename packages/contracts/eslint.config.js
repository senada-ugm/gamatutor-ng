import { config } from "@workspace/eslint-config/base"

/** @type {import("eslint").Linter.Config[]} */
export default [
  // gen/ is emitted from main.tsp via hey-api — regenerate, never hand-edit.
  { ignores: ["gen/**"] },
  // build helper scripts are plain Node (no @types/node here for globals)
  { files: ["scripts/**/*.mjs"], languageOptions: { globals: { URL: "readonly", console: "readonly" } } },
  ...config,
]
