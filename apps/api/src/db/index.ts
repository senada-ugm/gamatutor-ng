import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { env } from "../env.js"
import * as authSchema from "./auth-schema.js"
import * as appSchema from "./app-schema.js"

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

export const db = drizzle(pool, { schema: { ...authSchema, ...appSchema } })

/** A drizzle transaction handle — services that participate in a caller's
 *  transaction take this as an optional parameter and fall back to the
 *  root db when absent. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
