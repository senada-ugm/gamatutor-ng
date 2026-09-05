export type Verb =
  | 'launched'
  | 'experienced'
  | 'interacted'
  | 'answered'
  | 'completed'
  | 'passed'
  | 'failed'
  | 'terminated';

export interface Score {
  raw: number;
  min: number;
  max: number;
}

export interface Statement {
  verb: Verb;
  objectId: string;
  result?: { response?: string; success?: boolean; score?: Score };
  context?: Record<string, unknown>;
  timestamp: string;
}

export interface ResumeState {
  moduleId: string;
  pageId: string;
  data?: Record<string, unknown>;
}

export interface Outcome {
  completed: boolean;
  success?: boolean;
  score?: Score;
}

export function statement(
  verb: Verb,
  objectId: string,
  extra: Omit<Statement, 'verb' | 'objectId' | 'timestamp'> = {},
): Statement {
  return { verb, objectId, timestamp: new Date().toISOString(), ...extra };
}
