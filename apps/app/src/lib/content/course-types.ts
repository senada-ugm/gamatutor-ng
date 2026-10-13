export interface RevealStepText {
  texts: string[]
}

export interface RevealStepImage {
  image: string
  title?: string
  body?: string
}

export interface RevealStepVideo {
  video: {
    src: string
    poster?: string
  }
}

export type RevealStep = RevealStepText | RevealStepImage | RevealStepVideo

export interface BasePage {
  id: string
  slide?: number
  kicker?: string
  title?: string
  transcript?: string
}

export interface HeroPage extends BasePage {
  type: "hero"
  title: string
  body?: string
}

export interface DividerPage extends BasePage {
  type: "divider"
  title: string
}

export interface ContentPage extends BasePage {
  type: "content"
  title?: string
  body?: string
  image?: string
  imageLayout?: "below"
  imageCaption?: string
  reveal_steps?: RevealStep[]
}

export interface CardItem {
  big?: string
  title?: string
  body: string
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

export interface QuizPage extends BasePage {
  type: "quiz"
  graded?: boolean
  question: string
  options: QuizOption[]
  correct: string
  explanation: string
}

export type SlidePage =
  HeroPage | DividerPage | ContentPage | CardsPage | HotspotPage | MatchPage | ImageGradingPage | QuizPage

export interface CourseModule {
  id: string
  label: string
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
  }
  passingScore?: number
  assessment?: {
    mode: string
  }
  modules: CourseModule[]
}
