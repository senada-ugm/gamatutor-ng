import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { nativeButtonVariants } from "@workspace/ui/composed/native-button"

/**
 * Native anchor with shadcn Button styling. Composed for the same reason
 * as native-button: apps/web's SSR + hydration pipeline can't dispatch
 * events through Base UI elements, so external-origin CTA links (the SPA
 * handoff) render a plain <a> carrying the button's variant classes.
 */
type NativeAnchorProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & VariantProps<typeof nativeButtonVariants>

function NativeAnchor({ className, variant = "default", size = "default", ...props }: NativeAnchorProps) {
  return <a data-slot="button" className={cn(nativeButtonVariants({ variant, size }), className)} {...props} />
}

export { NativeAnchor }
