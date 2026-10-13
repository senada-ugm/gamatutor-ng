import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Zap, RotateCcw, ShieldCheck, Building2, User, Loader2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
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
        return <ShieldCheck className="h-3.5 w-3.5 text-red-500" />
      case "owner":
        return <Building2 className="h-3.5 w-3.5 text-blue-500" />
      default:
        return <User className="h-3.5 w-3.5 text-emerald-500" />
    }
  }

  return (
    <div className="mb-4 space-y-3 rounded-xl border border-dashed border-amber-500/50 bg-amber-500/5 p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 animate-pulse text-amber-500" />
          <span className="text-xs font-semibold tracking-tight text-amber-700 dark:text-amber-400">
            DEV_MODE Demonstration Controls
          </span>
          <Badge variant="outline" className="border-amber-500/30 text-[10px] text-amber-600 dark:text-amber-300">
            Active
          </Badge>
        </div>

        <AlertDialog open={openResetDialog} onOpenChange={setOpenResetDialog}>
          <AlertDialogTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 border-destructive/30 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={resetMutation.isPending}
              />
            }
          >
            {resetMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            Reset & Seed DB
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

      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-muted-foreground">Quick Sign In as:</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {accounts.map((acc) => (
            <Button
              key={acc.email}
              type="button"
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => onSelectAccount(acc.email, acc.password)}
              className="flex h-auto items-center justify-start gap-1.5 border-border/80 px-2.5 py-2 text-left hover:border-amber-500/40 hover:bg-amber-500/10"
            >
              {getRoleIcon(acc.role)}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs leading-tight font-medium">{acc.name}</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">{acc.email}</p>
              </div>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
