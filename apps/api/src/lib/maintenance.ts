import { getPlatformSettings } from "../modules/platform-settings/services/platform-settings.service.js"

/**
 * Maintenance-mode gate state, cached briefly because the onRequest
 * hook consults it on every business request. The platform-settings
 * PATCH route invalidates on write so an admin toggle takes effect
 * immediately instead of after the TTL.
 */
let cached: { value: boolean; at: number } | null = null
const TTL_MS = 10_000

export async function isMaintenanceMode(): Promise<boolean> {
  if (!cached || Date.now() - cached.at > TTL_MS) {
    const settings = await getPlatformSettings()
    cached = { value: settings.maintenanceMode, at: Date.now() }
  }
  return cached.value
}

export function invalidateMaintenanceCache(): void {
  cached = null
}
