import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { buildApp } from "./app.js"
import { db, pool } from "./db/index.js"
// Importing env validates it — the process exits on invalid config before
// the server ever boots.
import { env } from "./env.js"

function resolveMigrationsFolder(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "drizzle"),
    path.resolve(process.cwd(), "apps/api/drizzle"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle"),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate) && existsSync(path.join(candidate, "meta", "_journal.json"))) {
      return candidate
    }
  }
  return null
}

const app = await buildApp()

if (env.AUTO_MIGRATE) {
  const migrationsFolder = resolveMigrationsFolder()
  if (!migrationsFolder) {
    app.log.warn("AUTO_MIGRATE is enabled, but drizzle migrations folder was not found")
  } else {
    app.log.info({ migrationsFolder }, "Executing database migrations...")
    const start = Date.now()
    try {
      await migrate(db, { migrationsFolder })
      app.log.info({ durationMs: Date.now() - start }, "Database migrations applied successfully")
    } catch (err) {
      app.log.error(err, "Failed to apply database migrations")
      process.exit(1)
    }
  }
}

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, shutting down gracefully`)
  await app.close()
  await pool.end().catch((err) => app.log.error(err, "Error closing DB pool"))
  process.exit(0)
}

process.on("SIGTERM", () => void shutdown("SIGTERM"))
process.on("SIGINT", () => void shutdown("SIGINT"))
