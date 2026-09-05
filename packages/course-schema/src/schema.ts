import { z } from 'zod';

const RevealStepSchema = z.union([
  z.object({ texts: z.array(z.string()).min(1) }),
  z.object({ image: z.string(), title: z.string().optional(), body: z.string().optional() }),
  z.object({ video: z.object({ src: z.string(), poster: z.string().optional() }) }),
]);

const base = { id: z.string().min(1), slide: z.number().int().optional() };

const HeroSchema = z.object({
  ...base,
  type: z.literal('hero'),
  title: z.string(),
  body: z.string().optional(),
});

const DividerSchema = z.object({
  ...base,
  type: z.literal('divider'),
  kicker: z.string().optional(),
  title: z.string(),
});

const ContentSchema = z.object({
  ...base,
  type: z.literal('content'),
  kicker: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  transcript: z.string().optional(),
  image: z.string().optional(),
  imageLayout: z.literal('below').optional(),
  imageCaption: z.string().optional(),
  reveal_steps: z.array(RevealStepSchema).optional(),
});

const CardsSchema = z.object({
  ...base,
  type: z.literal('cards'),
  kicker: z.string().optional(),
  title: z.string().optional(),
  intro: z.string().optional(),
  transcript: z.string().optional(),
  columns: z.number().int().min(1).max(4).optional(),
  cards: z.array(
    z.object({
      big: z.string().optional(),
      title: z.string().optional(),
      body: z.string(),
      dark: z.boolean().optional(),
    }),
  ),
  trailingImage: z.string().optional(),
  trailingCaption: z.string().optional(),
  trailingNote: z.string().optional(),
});

const HotspotSchema = z.object({
  ...base,
  type: z.literal('hotspot'),
  kicker: z.string().optional(),
  title: z.string(),
  intro: z.string().optional(),
  image: z.string(),
  points: z.array(z.object({ x: z.number(), y: z.number(), label: z.string(), body: z.string() })),
  masks: z
    .array(z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }))
    .optional(),
});

const MatchSchema = z.object({
  ...base,
  type: z.literal('match'),
  kicker: z.string().optional(),
  title: z.string(),
  intro: z.string().optional(),
  pairs: z.array(z.object({ id: z.string(), left: z.string(), right: z.string() })).min(2),
});

const ImageGradingSchema = z.object({
  ...base,
  type: z.literal('image-grading'),
  level: z.string().optional(),
  image: z.string(),
  options: z.array(z.string()).min(2),
  correct: z.string(),
  reasoning: z.string(),
  lesions: z.array(z.object({ x: z.number(), y: z.number(), label: z.string() })),
});

const QuizSchema = z.object({
  ...base,
  type: z.literal('quiz'),
  graded: z.boolean().default(true),
  question: z.string(),
  options: z.array(z.object({ letter: z.string(), text: z.string() })).min(2),
  correct: z.string(),
  explanation: z.string(),
});

const VideoSchema = z.object({
  ...base,
  type: z.literal('video'),
  title: z.string().optional(),
  src: z.string(),
  poster: z.string().optional(),
  captions: z.string().optional(),
});

export const PageSchema = z.discriminatedUnion('type', [
  HeroSchema,
  DividerSchema,
  ContentSchema,
  CardsSchema,
  HotspotSchema,
  MatchSchema,
  ImageGradingSchema,
  QuizSchema,
  VideoSchema,
]);

export const ModuleSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  completion: z.boolean().optional(),
  pages: z.array(PageSchema),
});

export const CourseSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  title: z.string(),
  language: z.string().default('id-ID'),
  brand: z.object({ name: z.string(), mark: z.string() }),
  passingScore: z.number().min(0).max(1),
  assessment: z.object({ mode: z.enum(['formative', 'secured']) }),
  modules: z.array(ModuleSchema).min(1),
});
