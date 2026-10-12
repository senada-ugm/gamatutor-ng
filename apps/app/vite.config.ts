import { existsSync } from "node:fs"
import path from "node:path"
import { defineConfig } from "vite"
import type { Plugin } from "vite"
import tailwindcss from "@tailwindcss/vite"
import viteReact from "@vitejs/plugin-react"

/**
 * hey-api's generated files (packages/contracts/gen/*) use NodeNext-style
 * relative imports — `from "./client.gen.js"` pointing at an actual
 * `client.gen.ts`. tsc resolves that itself; Vite needs this plugin.
 * Scoped to packages/ so node_modules `.js` imports are never touched.
 */
function workspaceNodeNextImports(): Plugin {
  return {
    name: "workspace-nodenext-imports",
    resolveId(source, importer) {
      if (!source.endsWith(".js") || !importer) return null
      const candidate = path.resolve(path.dirname(importer), source)
      const marker = `${path.sep}packages${path.sep}`
      if (!candidate.includes(marker)) return null
      const tsCandidate = candidate.replace(/\.js$/, ".ts")
      return existsSync(tsCandidate) ? tsCandidate : null
    },
  }
}

const config = defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  plugins: [workspaceNodeNextImports(), tailwindcss(), viteReact()],
})

export default config
