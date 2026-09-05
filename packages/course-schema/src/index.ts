import { CourseSchema } from './schema.js';
import type { Course } from './types.js';

export * from './schema.js';
export * from './types.js';

export function parseCourse(raw: unknown): Course {
  return CourseSchema.parse(raw);
}
