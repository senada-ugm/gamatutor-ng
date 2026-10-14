import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Layers, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

import { apiGet, apiSend } from "@/lib/api"
import type { ContractSlideDeck } from "@workspace/contracts/domain"

/**
 * The interactive-deck authoring surface (PLANS 4.4): import a deck
 * manifest JSON onto the course so a new interactive training (the
 * planned AMD/DME follow-ups) ships without code changes. The manifest's
 * shape is the player's course-types; assets are referenced by URL
 * inside the manifest (public content paths or upload URLs).
 */
export function DeckUploadCard({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const deck = useQuery({
    queryKey: ["slide-deck", courseId],
    queryFn: () => apiGet<ContractSlideDeck>(`/courses/${courseId}/slide-deck`),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const upsert = useMutation({
    mutationFn: (manifest: Record<string, unknown>) =>
      apiSend<ContractSlideDeck>(`PUT`, `/courses/${courseId}/slide-deck`, {
        schemaVersion: 1,
        manifest,
      }),
    onSuccess: (saved) => {
      toast.success("Deck interaktif tersimpan", {
        description: `${(saved.manifest as { modules?: unknown[] })?.modules?.length ?? "?"} modul terpasang.`,
      })
      void queryClient.invalidateQueries({ queryKey: ["slide-deck", courseId] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menyimpan deck"),
  })

  async function handleFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      let parsed: unknown
      try {
        parsed = JSON.parse(await file.text())
      } catch {
        throw new Error("File bukan JSON yang valid")
      }
      const manifest = parsed as { schemaVersion?: unknown; modules?: unknown }
      if (
        typeof manifest !== "object" ||
        manifest === null ||
        typeof manifest.schemaVersion !== "number" ||
        !Array.isArray(manifest.modules) ||
        manifest.modules.length === 0
      ) {
        throw new Error("Manifest tidak dikenali: butuh schemaVersion (angka) dan modules (array tidak kosong)")
      }
      upsert.mutate(parsed as Record<string, unknown>)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membaca file deck")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const attached = deck.data
  const moduleCount = (attached?.manifest as { modules?: unknown[] } | undefined)?.modules?.length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="size-4 text-primary" />
          Deck Interaktif {attached ? "(terpasang)" : "(opsional)"}
        </CardTitle>
        <CardDescription>
          Pelatihan dengan deck interaktif (slide narasi, hotspot, simulasi grading) menggantikan materi pelajaran biasa
          di halaman peserta. Unggah manifest JSON deck — aset (audio/gambar/video) dirujuk lewat URL di dalam manifest.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={uploading || upsert.isPending}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" />
            {attached ? "Ganti Manifest Deck" : "Unggah Manifest Deck"}
          </Button>
          {attached ? (
            <span className="text-xs text-muted-foreground">
              schema v{attached.schemaVersion} · {moduleCount ?? "?"} modul · diperbarui{" "}
              {new Date(attached.updatedAt).toLocaleDateString("id-ID")}
              {attached.postTestQuizId ? " · post-test server-side aktif" : ""}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Tanpa deck, peserta mempelajari materi modul/pelajaran di bawah.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
