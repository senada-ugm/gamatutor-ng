import type { Course } from '@gamatutor/course-schema';

/**
 * The course as the frozen original knew it. Pages added after S0 (the
 * `embed` type, which the original never had) are dropped, so the parity
 * suites keep proving the extraction while the live course grows. Every other
 * page must still match the original click for click.
 */
export function legacyEquivalent(course: Course): Course {
  return {
    ...course,
    modules: course.modules.map((m) => ({
      ...m,
      pages: m.pages.filter((p) => p.type !== 'embed'),
    })),
  };
}
