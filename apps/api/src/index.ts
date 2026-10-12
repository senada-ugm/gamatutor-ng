import { buildApp } from "./app.js"
import { pool } from "./db/index.js"
// Importing env validates it — the process exits on invalid config before
// the server ever boots.
import { env } from "./env.js"

const app = await buildApp()

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
