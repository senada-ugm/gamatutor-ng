import { defineConfig } from "@hey-api/openapi-ts"

// Adapted from the vamios-core contract standard. Relying on the
// deterministically compiled TypeSpec artifact (not a live server) for
// reproducible generation; generated `.gen.ts` files are committed as-is
// and lint/format-ignored.
export default defineConfig({
  input: "./tsp-output/openapi/3.1.0/openapi.yaml",
  output: {
    // NOTE: hey-api wipes its output directory on every run, so this must
    // NOT be ./src — authored files (domain.ts) live there.
    path: "./gen",
  },
  plugins: [
    {
      name: "@hey-api/typescript",
      // Enums as plain JS objects — avoids the type-level complications of
      // native TS enums.
      enums: "javascript",
    },
    {
      // Zod schemas from the spec, used at runtime validation boundaries
      // (Fastify preValidation in apps/api).
      name: "zod",
    },
    {
      // Strictly-typed, tree-shakable SDK methods. No `validator: true` —
      // payloads aren't forced through a runtime Zod parse; use the
      // generated schemas manually where needed.
      name: "@hey-api/sdk",
    },
    {
      // Universal baseline client — native fetch works in Node and the
      // browser alike.
      name: "@hey-api/client-fetch",
    },
  ],
})
