import { cn } from "@workspace/ui/lib/utils"

export const DRIVE_LOGO_SRC = "/images/drive-logo.png"

/**
 * The DRIVE Learn brand mark: the DRIVE (Diabetic Retinopathy Initiative)
 * logo with the platform word "Learn" after it. Replaces the old eye-icon
 * + "DRIVE Learn" text mark (meeting 29 Okt 2026). The logo's navy and
 * teal disappear on the blue chrome (and in dark mode), so `onDark` puts
 * it on a white chip.
 */
export function DriveLogo({
  onDark = false,
  showLearn = true,
  className,
  logoClassName,
}: {
  onDark?: boolean
  showLearn?: boolean
  className?: string
  logoClassName?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center",
          onDark ? "rounded-md bg-white px-1.5 py-1 shadow-xs" : "dark:rounded-md dark:bg-white dark:px-1.5 dark:py-1"
        )}
      >
        <img
          src={DRIVE_LOGO_SRC}
          alt="DRIVE — Diabetic Retinopathy Initiative"
          className={cn("h-7 w-auto", logoClassName)}
        />
      </span>
      {showLearn ? (
        <span
          className={cn(
            "text-base leading-none font-extrabold tracking-tight",
            onDark ? "text-white" : "text-[#14a39a] dark:text-teal-300"
          )}
        >
          Learn
        </span>
      ) : null}
    </span>
  )
}
