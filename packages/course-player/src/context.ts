import type { Course } from '@gamatutor/course-schema';
import type { TrackingAdapter } from '@gamatutor/tracking';
import type { PlayerState } from './nav.js';
import type { NarrationControl } from './narration.js';

export interface PlayerCapabilities {
  narration: 'webspeech' | 'audio' | 'off';
  resume: boolean;
  certificate: boolean;
  offline: boolean;
  grading: 'client' | 'server';
}

export const DEFAULT_CAPABILITIES: PlayerCapabilities = {
  narration: 'webspeech',
  resume: false,
  certificate: true,
  offline: false,
  grading: 'client',
};

/** The single argument every page renderer takes. */
export interface RenderContext {
  document: Document;
  window: Window;
  course: Course;
  state: PlayerState;
  adapter: TrackingAdapter;
  capabilities: PlayerCapabilities;
  random: () => number;
  /** The current page's narration; inert on pages without one. */
  narration: NarrationControl;
  rerender: () => void;
  goNext: () => void;
  goPrev: () => void;
}
