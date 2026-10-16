import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  target: "node20",
  // @workspace/contracts exports TypeScript source (gen/*.ts), which plain
  // node cannot load from node_modules in the production image — bundle it.
  noExternal: ["@workspace/contracts"],
})
