import { existsSync } from "node:fs"
import path from "node:path"
import { defineConfig } from "vite"
import type { Plugin } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

/**
 * hey-api's generated files (packages/contracts/gen/*) use NodeNext-style
 * relative imports — `from "./client.gen.js"` pointing at an actual
 * `client.gen.ts`. tsc resolves that itself, webpack needed
 * resolve.extensionAlias (see apps/legacy/next.config.ts), and Vite needs
 * this: rewrite workspace-package `.js` specifiers to their `.ts` source.
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
  envPrefix: "VITE_",
  resolve: { tsconfigPaths: true },
  plugins: [workspaceNodeNextImports(), devtools(), tailwindcss(), tanstackStart(), viteReact()],
})

export default config
