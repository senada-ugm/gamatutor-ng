import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { Course } from '@gamatutor/course-schema';
import type { PlayerState } from '@gamatutor/course-player';
import { PlayerMount } from '@/client/player-mount';
import { getDb } from '@/db/client';
import { learningContext } from '@/server/catalogue';
import { requireUser } from '@/server/session';

export const metadata: Metadata = { title: 'Belajar' };

export default async function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/belajar/${slug}`);
  const ctx = await learningContext(await getDb(), user.id, slug);
  if (!ctx) redirect(`/kursus/${slug}`);
  return (
    <PlayerMount
      course={ctx.version.manifest as Course}
      courseTitle={ctx.course.title}
      attemptId={ctx.attempt.id}
      learnerName={user.fullName}
      assetBase={`/c/${ctx.version.id}/`}
      resume={(ctx.attempt.resumeState as Partial<PlayerState> | null) ?? null}
    />
  );
}
