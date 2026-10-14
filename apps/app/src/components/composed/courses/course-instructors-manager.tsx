import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { useConfirm } from "@/components/composed/_shared/confirm-dialog"
import { apiGet, apiSend } from "@/lib/api"
import type { ContractCourseInstructor, ContractCourseInstructorUser } from "@workspace/contracts/domain"

/**
 * The course editor's Instruktur tab — the per-course instructor
 * assignment list. Inviting/removing mirrors the API's narrow gate:
 * admin or the institution's owner only (course instructors themselves
 * get a read-only list).
 */

export function CourseInstructorsManager({
  courseId,
  institutionId,
  canInvite,
}: {
  courseId: string
  institutionId: string
  canInvite: boolean
}) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [error, setError] = useState<string | null>(null)

  const instructors = useQuery({
    queryKey: ["course-instructors", courseId],
    queryFn: () => apiGet<ContractCourseInstructor[]>(`/course-instructors?courseId=${courseId}&pageSize=100`),
  })

  // Powers the invite form's datalist — instructors already teaching
  // elsewhere in this institution, so they don't need retyping per course.
  const roster = useQuery({
    queryKey: ["institution-roster", institutionId, courseId],
    queryFn: () =>
      apiGet<ContractCourseInstructorUser[]>(
        `/course-instructors/institution-roster?institutionId=${institutionId}&excludeCourseId=${courseId}&pageSize=100`
      ),
    enabled: canInvite,
  })

  const invite = useMutation({
    mutationFn: (email: string) =>
      apiSend<ContractCourseInstructor>("POST", "/course-instructors", {
        courseId,
        email,
        role: "instructor",
      }),
    onSuccess: (created) => {
      toast.success(
        created.status === "active"
          ? "Instruktur berhasil ditambahkan"
          : "Undangan dikirim — instruktur ditambahkan saat mereka mendaftar"
      )
      setShowInvite(false)
      setInviteEmail("")
      setError(null)
      void queryClient.invalidateQueries({
        queryKey: ["course-instructors", courseId],
      })
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Gagal menambahkan instruktur"),
  })

  const changeRole = useMutation({
    mutationFn: (input: { id: string; role: "instructor" | "co_instructor" }) =>
      apiSend<ContractCourseInstructor>("PATCH", `/course-instructors/${input.id}/role`, { role: input.role }),
    onSuccess: () => {
      toast.success("Peran instruktur diperbarui")
      void queryClient.invalidateQueries({
        queryKey: ["course-instructors", courseId],
      })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal mengubah peran"),
  })

  const remove = useMutation({
    mutationFn: (instructorId: string) => apiSend<null>("DELETE", `/course-instructors/${instructorId}`),
    onSuccess: () => {
      toast.success("Instruktur dihapus")
      void queryClient.invalidateQueries({
        queryKey: ["course-instructors", courseId],
      })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menghapus instruktur"),
  })

  function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault()
    const normalized = inviteEmail.trim().toLowerCase()
    if (!normalized) {
      setError("Email harus diisi")
      return
    }
    if ((instructors.data ?? []).some((i) => i.email.toLowerCase() === normalized)) {
      setError("Instruktur dengan email tersebut sudah terdaftar pada pelatihan ini.")
      return
    }
    setError(null)
    invite.mutate(normalized)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium">Instruktur Pelatihan</h2>
          <p className="text-sm text-muted-foreground">
            {canInvite
              ? "Kelola instruktur yang dapat mengajar pelatihan ini"
              : "Hanya pemilik institusi atau admin yang dapat mengundang instruktur."}
          </p>
        </div>
        {canInvite ? <Button onClick={() => setShowInvite((v) => !v)}>Undang Instruktur</Button> : null}
      </div>

      {canInvite && showInvite ? (
        <Card>
          <CardContent>
            <form onSubmit={handleInviteSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="instructor-email">Email</Label>
                <Input
                  id="instructor-email"
                  type="email"
                  list="institution-roster"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@contoh.com"
                  autoComplete="off"
                />
                <datalist id="institution-roster">
                  {(roster.data ?? []).map((person) => (
                    <option key={person.id} value={person.email}>
                      {person.name}
                    </option>
                  ))}
                </datalist>
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <p className="text-xs text-muted-foreground">
                Jika pengguna sudah terdaftar, mereka langsung ditambahkan; jika belum, undangan menunggu pendaftaran
                mereka.
              </p>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={invite.isPending}>
                  {invite.isPending ? "Mengirim..." : "Kirim Undangan"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowInvite(false)}>
                  Batal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {instructors.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (instructors.data ?? []).length === 0 ? (
        <EmptyState
          title="Belum ada instruktur tambahan"
          description="Undang instruktur untuk membantu mengajar pelatihan ini."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                {canInvite ? <TableHead className="text-right">Aksi</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(instructors.data ?? []).map((instructor) => (
                <TableRow key={instructor.id}>
                  <TableCell className="font-medium">{instructor.user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{instructor.user.email}</TableCell>
                  <TableCell>
                    <Badge variant={instructor.status === "active" ? "default" : "secondary"}>
                      {instructor.status === "active" ? "Aktif" : "Menunggu"}
                    </Badge>
                    {canInvite ? (
                      <NativeSelect
                        className="ms-2"
                        size="sm"
                        value={instructor.role}
                        disabled={changeRole.isPending}
                        onChange={(e) =>
                          changeRole.mutate({
                            id: instructor.id,
                            role: e.target.value as "instructor" | "co_instructor",
                          })
                        }
                        aria-label={`Peran ${instructor.user.name}`}
                      >
                        <NativeSelectOption value="instructor">Instruktur</NativeSelectOption>
                        <NativeSelectOption value="co_instructor">Co-Instruktur</NativeSelectOption>
                      </NativeSelect>
                    ) : null}
                  </TableCell>
                  {canInvite ? (
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={remove.isPending}
                        onClick={() => {
                          void confirm({
                            title: "Hapus instruktur?",
                            description: `${instructor.user.name} kehilangan akses mengelola pelatihan ini.`,
                            confirmLabel: "Hapus",
                            destructive: true,
                          }).then((ok) => {
                            if (ok) remove.mutate(instructor.id)
                          })
                        }}
                      >
                        Hapus
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
