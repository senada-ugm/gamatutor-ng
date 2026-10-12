import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { router } from "@/router"
import { ConfirmProvider } from "@/components/composed/_shared/confirm-dialog"
import { Toaster } from "@/components/composed/_shared/toaster"
import "@/lib/api-client"
// Imported (not <link>ed) so the @tailwindcss/vite plugin compiles it —
// a raw stylesheet link ships preflight only, with zero utilities.
import "@workspace/ui/globals.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status
        if (status !== undefined && status >= 400 && status < 500) return false
        return failureCount < 2
      },
    },
  },
})

const app = (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <RouterProvider router={router} />
      </ConfirmProvider>
      <Toaster />
    </QueryClientProvider>
  </StrictMode>
)

createRoot(document.getElementById("root")!).render(app)
