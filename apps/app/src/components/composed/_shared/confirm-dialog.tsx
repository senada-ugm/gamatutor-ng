import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"

export interface ConfirmOptions {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Renders the confirm button in the destructive variant. */
  destructive?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/**
 * One confirmation idiom for the whole app. Every destructive action
 * used to call the browser's `window.confirm()` — an OS-chrome modal
 * that ignores the design tokens, can't be styled, reads as a phishing
 * prompt on mobile, and is suppressible by the browser after a few
 * uses (which would have silently turned "Hapus" into a no-op). This
 * routes all of them through the AlertDialog primitive instead.
 *
 * Mounted once at the app root; `useConfirm()` returns a promise-based
 * `confirm(options)` so call sites read the same as before.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value)
    resolverRef.current = null
    setOptions(null)
  }, [])

  const confirm = useCallback<ConfirmFn>((next) => {
    // A second request while one is open resolves the first as declined,
    // so an awaited caller is never left hanging.
    resolverRef.current?.(false)
    setOptions(next)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <AlertDialog open={options != null} onOpenChange={(open) => (open ? null : settle(false))}>
        {options ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{options.title}</AlertDialogTitle>
              {options.description ? <AlertDialogDescription>{options.description}</AlertDialogDescription> : null}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => settle(false)}>{options.cancelLabel ?? "Batal"}</AlertDialogCancel>
              <AlertDialogAction variant={options.destructive ? "destructive" : "default"} onClick={() => settle(true)}>
                {options.confirmLabel ?? "Lanjutkan"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>")
  return confirm
}
