import { Toaster as Sonner } from "sonner"
import type { ToasterProps } from "sonner"

/**
 * App-level sonner toaster wired to the design tokens. This MUST live in
 * the app (not packages/ui): pnpm can materialize multiple physical
 * sonner copies across workspace packages, and a Toaster in one copy
 * never sees toast() calls issued through another — the shared-package
 * version silently swallowed every toast. Same instance, same app, one
 * bus. (No next-themes here — the SPA has no theme provider; light
 * tokens apply.)
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
