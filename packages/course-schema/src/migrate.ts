import { parseCourse } from './index.js';
import type { Course } from './types.js';

export interface CourseMeta {
  id: string;
  title: string;
  brand: { name: string; mark: string };
  passingScore: number;
  language?: string;
}

const LEGACY_VIDEO = { src: 'assets/visus.mp4', poster: 'assets/visus_poster.jpg' } as const;

type Raw = Record<string, unknown>;

function migrateRevealStep(step: Raw): Raw {
  if (step['video'] === true) return { video: { ...LEGACY_VIDEO } };
  return step;
}

function migratePage(page: Raw, moduleId: string, index: number): Raw {
  const out: Raw = { ...page, id: page['id'] ?? `${moduleId}-p${index + 1}` };
  if (out['type'] === 'fundus') out['type'] = 'image-grading';
  if (out['type'] === 'quiz') {
    out['graded'] = true;
    // index/total were positional duplicates of the page's own ordering.
    delete out['index'];
    delete out['total'];
  }
  if (Array.isArray(out['reveal_steps'])) {
    out['reveal_steps'] = (out['reveal_steps'] as Raw[]).map(migrateRevealStep);
  }
  return out;
}

/**
 * Convert the unversioned legacy course JSON to schema v1. Idempotent: a v1
 * course passed back in comes out unchanged.
 */
export function migrateCourse(raw: unknown, meta: CourseMeta): Course {
  const src = raw as Raw;
  const modules = (src['modules'] as Raw[]).map((m) => {
    const id = String(m['id'] ?? m['key']);
    const pages = (m['pages'] as Raw[]).map((p, i) => migratePage(p, id, i));
    const out: Raw = { id, label: String(m['label']), pages };
    if (id === 'selesai' || m['completion'] === true) out['completion'] = true;
    return out;
  });

  return parseCourse({
    schemaVersion: 1,
    id: meta.id,
    title: meta.title,
    language: meta.language ?? 'id-ID',
    brand: meta.brand,
    passingScore: meta.passingScore,
    assessment: { mode: 'formative' },
    modules,
  });
}
