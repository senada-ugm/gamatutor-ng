/**
 * Physical backup of the app database via pg_dump (run with
 * `pnpm --filter api db:backup`). Writes a timestamped custom-format
 * dump under apps/api/backups/ (gitignored) and prints the restore
 * command — restoring is `pg_restore --clean --if-exists -d $DATABASE_URL
 * <file>`, or plain `psql` for the --inserts variant if you prefer SQL.
 *
 * Schedule externally (cron/Task Scheduler): this script is the
 * single-run primitive, not a scheduler. pg_dump must be on PATH and its
 * major version should match the server (a client one major version off
 * is usually fine, more refuses).
 */
import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { config } from "dotenv"

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
config({ path: path.join(appDirectory, ".env.local"), quiet: true })
config({ path: path.join(appDirectory, ".env"), quiet: true })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL is required (set it in .env.local or the environment)")
  process.exit(1)
}

const backupsDir = path.join(appDirectory, "backups")
mkdirSync(backupsDir, { recursive: true })

const now = new Date()
const stamp = now.toISOString().replace(/[:.]/g, "-")
const file = path.join(backupsDir, `lms-${stamp}.dump`)

const child = spawn("pg_dump", ["--format=custom", `--file=${file}`, databaseUrl], {
  stdio: ["ignore", "inherit", "inherit"],
})

/** pg_dump refuses servers newer than its own major version ("server
 *  version mismatch") — when that happens, look for the server's own
 *  container and print the exact docker exec that WOULD work. */
async function suggestDockerFallback() {
  try {
    const { execFile } = await import("node:child_process")
    const { promisify } = await import("node:util")
    const exec = promisify(execFile)
    const { stdout } = await exec("docker", ["ps", "--format", "{{.Names}}\t{{.Image}}"])
    const candidates = stdout
      .split("\n")
      .map((line) => line.split("\t"))
      .filter(([name, image]) => name && image && /postgres/i.test(image))
    if (candidates.length === 0) return
    console.error("\nA postgres container is running — dump from inside it (matching pg_dump version):")
    for (const [name, image] of candidates) {
      console.error(`  docker exec ${name} pg_dump --format=custom -U <user> <dbname> > "${file}"   # ${image}`)
    }
  } catch {
    // docker not installed / not in PATH — nothing to suggest.
  }
}

child.on("exit", async (code) => {
  if (code === 0) {
    console.log(`\nbackup written: ${file}`)
    console.log(`restore with:   pg_restore --clean --if-exists -d "$DATABASE_URL" "${file}"`)
  } else {
    console.error(`pg_dump exited with code ${code}`)
    await suggestDockerFallback()
    process.exit(code ?? 1)
  }
})
