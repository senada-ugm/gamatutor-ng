import type { z } from 'zod';
import type { CourseSchema, ModuleSchema, PageSchema } from './schema.js';

export type Course = z.infer<typeof CourseSchema>;
export type Module = z.infer<typeof ModuleSchema>;
export type Page = z.infer<typeof PageSchema>;
export type PageOfType<T extends Page['type']> = Extract<Page, { type: T }>;
