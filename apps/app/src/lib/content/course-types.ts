export interface RevealStepText {
  texts: string[]
  narration?: string
  cue?: number
}

export interface RevealStepImage {
  image: string
  title?: string
  body?: string
  narration?: string
  cue?: number
}

export interface RevealStepVideo {
  video: {
    src: string
    poster?: string
  }
  narration?: string
  cue?: number
}

export type RevealStep = RevealStepText | RevealStepImage | RevealStepVideo

export interface BasePage {
  id: string
  slide?: number
  kicker?: string
  title?: string
  transcript?: string
  audio?: string
  /** The slide's source list (PPTX speaker notes "REFERENSI"), shown in
   *  the Daftar Referensi box under the narration bar. */
  references?: string[]
  /** "ABBR, expansion" entries (PPTX "DAFTAR SINGKATAN"), shown in the
   *  Daftar Singkatan box beside the references. */
  abbreviations?: string[]
}

export interface HeroPage extends BasePage {
  type: "hero"
  title: string
  body?: string
}

export interface DividerPage extends BasePage {
  type: "divider"
  title: string
  body?: string
}

export interface ContentPage extends BasePage {
  type: "content"
  title?: string
  body?: string
  image?: string
  imageLayout?: "below"
  imageCaption?: string
  table?: ContentTable
  reveal_steps?: RevealStep[]
}

export interface ContentTable {
  head: string[]
  rows: string[][]
  caption?: string
}

export interface CardItem {
  big?: string
  title?: string
  body: string
  image?: string
  dark?: boolean
}

export interface CardsPage extends BasePage {
  type: "cards"
  title?: string
  intro?: string
  columns?: number
  cards: CardItem[]
  trailingImage?: string
  trailingCaption?: string
  trailingNote?: string
}

export interface HotspotPoint {
  x: number
  y: number
  label: string
  body: string
  audio?: string
}

export interface HotspotMask {
  x: number
  y: number
  w: number
  h: number
}

export interface HotspotPage extends BasePage {
  type: "hotspot"
  kicker?: string
  title: string
  intro?: string
  image: string
  imageCaption?: string
  points: HotspotPoint[]
  masks?: HotspotMask[]
}

export interface MatchPair {
  id: string
  left: string
  right: string
}

export interface MatchPage extends BasePage {
  type: "match"
  kicker?: string
  title: string
  intro?: string
  pairs: MatchPair[]
}

export interface LesionCoordinate {
  x: number
  y: number
  label: string
  /** Where the label sits relative to the lesion, in % of the image —
   *  authored when the default (pointing outward from the image centre)
   *  would land the label on another lesion. */
  dx?: number
  dy?: number
}

export interface ImageGradingPage extends BasePage {
  type: "image-grading"
  level?: string
  image: string
  options: string[]
  correct: string
  reasoning: string
  lesions: LesionCoordinate[]
}

export interface QuizOption {
  letter: string
  text: string
}

export interface TestQuestion {
  id: string
  question: string
  options: QuizOption[]
  correct: string
  explanation: string
  references?: string[]
}

/**
 * A whole multiple-choice test on one slide. `post` is the graded Post
 * Test (the deck's postTestQuizId); `pre` is the ungraded Pre Test (the
 * deck's preTestQuizId, recorded for pre/post comparison only); `practice`
 * is a module's self-check Evaluasi, scored locally and never recorded.
 * The DRIVE team's rule is that Pre and Post Test share one question set,
 * so only the post page carries `questions` — any test page without its
 * own falls back to the post test's.
 */
export interface TestPage extends BasePage {
  type: "test"
  mode: "pre" | "post" | "practice"
  title: string
  intro?: string
  questions?: TestQuestion[]
}

/** The course's closing slide (the "Selesai" step): the completion text
 *  and the certificate claim. */
export interface CompletionPage extends BasePage {
  type: "completion"
  title: string
}

export type SlidePage =
  | HeroPage
  | DividerPage
  | ContentPage
  | CardsPage
  | HotspotPage
  | MatchPage
  | ImageGradingPage
  | TestPage
  | CompletionPage

export interface CourseModule {
  id: string
  label: string
  /** The sidebar heading this step sits under ("Modul 1"); also the
   *  badge in the slide header, so a page reads "(Modul 1) BAB 1 – …". */
  group?: string
  /** Announced in the sidebar but not yet written: no pages, never
   *  reached by the linear walk, shown greyed out as "segera hadir". */
  placeholder?: boolean
  pages: SlidePage[]
  completion?: boolean | Record<string, unknown>
}

export interface CourseDefinition {
  schemaVersion: number
  id: string
  title: string
  language: string
  brand?: {
    name: string
    mark: string
    logo?: string
  }
  passingScore?: number
  assessment?: {
    mode: string
  }
  completion?: {
    body?: string
    certificateText?: string
  }
  modules: CourseModule[]
}
