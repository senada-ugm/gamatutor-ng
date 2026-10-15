import type { FastifyInstance } from "fastify"
import { zPlatformSettingsUpdate } from "@workspace/contracts/zod"
import { requireAdmin } from "../../lib/require-admin.js"
import { invalidateMaintenanceCache } from "../../lib/maintenance.js"
import { dataResponse } from "../../lib/response.js"
import { validateBody } from "../../lib/validation.js"
import * as service from "./services/platform-settings.service.js"

export async function platformSettingsModule(app: FastifyInstance) {
  app.get("/platform-settings", async (request) => {
    await requireAdmin(request)
    return dataResponse(await service.getPlatformSettings(), request.id)
  })

  app.patch("/platform-settings", { preValidation: [validateBody(zPlatformSettingsUpdate)] }, async (request) => {
    const admin = await requireAdmin(request)
    const settings = await service.updatePlatformSettings(request.body as Record<string, unknown>)
    invalidateMaintenanceCache()
    return dataResponse(settings, request.id)
  })
}
