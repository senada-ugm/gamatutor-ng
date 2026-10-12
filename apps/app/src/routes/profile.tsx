import { useQuery } from "@tanstack/react-query"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { ParticipantProfileForm } from "@/components/composed/account/participant-profile-form"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { apiGet } from "@/lib/api"
import { useSession } from "@/lib/session"
import type { ContractParticipantProfile } from "@workspace/contracts/domain"

/**
 * The account holder's own participant profile. The API returns an
 * empty-but-valid shape for an account that has never enrolled, so this
 * never has a "no profile yet" state — the form is always editable.
 */
export function ProfilePage() {
  const session = useSession()
  const userId = session.data?.id

  const profile = useQuery({
    queryKey: ["participant-profile", userId],
    queryFn: () => apiGet<ContractParticipantProfile>(`/participant-profiles/${userId}`),
    enabled: userId != null,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/dashboard"
        backLabel="Dasbor"
        title="Profil Saya"
        description="Data pendaftar yang dinilai saat Anda melamar pelatihan."
      />
      {profile.isLoading || !userId ? (
        <Skeleton className="h-96 w-full" />
      ) : profile.isError ? (
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      ) : profile.data ? (
        // Remounted per account so the form seeds its state from the
        // loaded profile rather than holding a previous account's values.
        <ParticipantProfileForm key={profile.data.id} profile={profile.data} />
      ) : null}
    </div>
  )
}
