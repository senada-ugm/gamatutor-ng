import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Zap, ChevronDown, RotateCcw, ShieldCheck, Building2, User, Loader2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { apiGet, apiSend } from "@/lib/api"

interface DevAccount {
  role: string
  name: string
  email: string
  password: string
  description: string
}

interface DevStatusResponse {
  devMode: boolean
  accounts: DevAccount[]
}

interface DevModeBarProps {
  onSelectAccount: (email: string, password: string) => void
  submitting?: boolean
}

export function DevModeBar({ onSelectAccount, submitting }: DevModeBarProps) {
  const [openResetDialog, setOpenResetDialog] = useState(false)

  const { data: devStatus } = useQuery<DevStatusResponse>({
    queryKey: ["dev-status"],
    queryFn: async () => {
      try {
        return await apiGet<DevStatusResponse>("/dev/status")
      } catch {
        return { devMode: false, accounts: [] }
      }
    },
    staleTime: 60_000,
  })

  const resetMutation = useMutation({
    mutationFn: async () => {
      return await apiSend<{ success: boolean; message: string }>("POST", "/dev/reset-seed", {
        confirm: "CONFIRM_DATABASE_RESET",
      })
    },
    onSuccess: (data) => {
      toast.success("Database Reset Complete", {
        description: data.message ?? "Database seeded with clean baseline demo state.",
      })
      setOpenResetDialog(false)
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    },
    onError: (err) => {
      toast.error("Database Reset Failed", {
        description: err instanceof Error ? err.message : "Failed to reset demo database.",
      })
    },
  })

  const isDevMode = import.meta.env.VITE_DEV_MODE === "true" || devStatus?.devMode === true
  if (!isDevMode) return null

  const accounts = devStatus?.accounts?.length
    ? devStatus.accounts
    : [
        {
          role: "admin",
          name: "LMS Admin",
          email: "admin@lms.dev",
          password: "correcthorsebatterystaple",
          description: "Platform Admin",
        },
        {
          role: "owner",
          name: "Institution Owner",
          email: "owner@lms.dev",
          password: "correcthorsebatterystaple",
          description: "Institution Owner",
        },
        {
          role: "user",
          name: "Doctor / Learner",
          email: "user@lms.dev",
          password: "correcthorsebatterystaple",
          description: "Clinical Trainee",
        },
      ]

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <ShieldCheck className="h-4 w-4 text-red-500" />
      case "owner":
        return <Building2 className="h-4 w-4 text-blue-500" />
      default:
        return <User className="h-4 w-4 text-emerald-500" />
    }
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="h-7 w-full gap-1 border-border px-2 text-xs font-medium hover:bg-input/50 hover:text-foreground dark:bg-input/30"
              disabled={submitting}
            />
          }
        >
          <Zap className="h-4 w-4 text-yellow-500" />
          <span>Masuk Instan</span>
          <ChevronDown className="ml-auto h-4 w-4 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[--anchor-width] min-w-56 p-1">
          {accounts.map((acc) => (
            <DropdownMenuItem
              key={acc.email}
              onClick={() => onSelectAccount(acc.email, acc.password)}
              className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                {getRoleIcon(acc.role)}
                <div className="min-w-0">
                  <p className="truncate text-xs leading-none font-medium">{acc.name}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{acc.email}</p>
                </div>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={openResetDialog} onOpenChange={setOpenResetDialog}>
        <AlertDialogTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="h-7 w-full gap-1 border-destructive/40 px-2 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={resetMutation.isPending}
            />
          }
        >
          {resetMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
          <span>Reset DB & Seed</span>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset and re-seed demo database?</AlertDialogTitle>
            <AlertDialogDescription>
              This will wipe all existing courses, student enrollments, attendance check-ins, and telemetry logs,
              restoring the platform to the initial canonical UGM DRIVE demo state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                resetMutation.mutate()
              }}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? "Resetting..." : "Yes, Reset & Seed"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
