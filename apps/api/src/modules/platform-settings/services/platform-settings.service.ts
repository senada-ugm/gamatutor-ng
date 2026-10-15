import type { PlatformSettings } from "@workspace/contracts"
import { eq } from "drizzle-orm"
import { db } from "../../../db/index.js"
import { platformSettings } from "../../../db/app-schema.js"

const SETTINGS_ROW_ID = "global"
const DEFAULTS = {
  id: SETTINGS_ROW_ID,
  platformName: "Solo Kerja",
  supportEmail: "dukungan@solokerja.example.test",
  // Single-tenant frontend (PLANS Phase 5): the self-service request
  // flow is closed by default — institutions are granted by admins.
  allowInstitutionRequests: false,
}

function toSettings(row: typeof platformSettings.$inferSelect): PlatformSettings {
  return {
    platformName: row.platformName,
    supportEmail: row.supportEmail,
    supportPhone: row.supportPhone ?? undefined,
    maintenanceMode: row.maintenanceMode,
    allowInstitutionRequests: row.allowInstitutionRequests,
    certificateValidityMonths: row.certificateValidityMonths,
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Reads the singleton settings row, seeding defaults on first access. */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const [existing] = await db.select().from(platformSettings).where(eq(platformSettings.id, SETTINGS_ROW_ID)).limit(1)
  if (existing) return toSettings(existing)
  const [seeded] = await db.insert(platformSettings).values(DEFAULTS).onConflictDoNothing().returning()
  if (seeded) return toSettings(seeded)
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.id, SETTINGS_ROW_ID)).limit(1)
  return toSettings(row!)
}

export async function updatePlatformSettings(patch: Record<string, unknown>): Promise<PlatformSettings> {
  await getPlatformSettings() // ensure the row exists
  await db
    .update(platformSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(platformSettings.id, SETTINGS_ROW_ID))
  return getPlatformSettings()
}

/** The self-service institution-request gate (see institution-requests
 *  routes): false = the request form is closed platform-wide. */
export async function institutionRequestsAllowed(): Promise<boolean> {
  return (await getPlatformSettings()).allowInstitutionRequests
}
