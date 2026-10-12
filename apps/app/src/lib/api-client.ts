import { client } from "@workspace/contracts/client"

/**
 * Configures the generated hey-api client singleton for apps/app.
 */
client.setConfig({
  baseUrl: `${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/v1`,
  credentials: "include",
})

export { client }
