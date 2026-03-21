export const allowedPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL'] as const;
export const allowedContestTypes = ['cash', 'tournament', 'simulation'] as const;
export const allowedModes = ['bootstrap-demo'] as const;
export const allowedInjuryStatuses = ['healthy', 'questionable', 'doubtful', 'out'] as const;
export const allowedErrorCategories = ['VALIDATION_ERROR', 'CONFIG_ERROR', 'NOT_READY', 'NOT_FOUND', 'INTERNAL_ERROR'] as const;

export type Position = (typeof allowedPositions)[number];
export type ContestType = (typeof allowedContestTypes)[number];
export type ForgeMode = (typeof allowedModes)[number];
export type InjuryStatus = (typeof allowedInjuryStatuses)[number];
export type ErrorCategory = (typeof allowedErrorCategories)[number];

export interface PlayerInput {
  playerId: string;
  playerName: string;
  team: string;
  opponent: string;
  position: Position;
  salary?: number;
  projectedMinutes?: number;
  recentFantasyPoints?: number;
  injuryStatus: InjuryStatus;
  tags: string[];
}

export interface EvaluationContext {
  slateId: string;
  slateDate: string;
  sport: string;
  site: string;
  contestType: ContestType;
  mode: ForgeMode;
}

export interface EvaluateRequest {
  requestId?: string;
  player: PlayerInput;
  context: EvaluationContext;
}

export interface ScoreComponent {
  name: 'opportunity' | 'recent-form' | 'salary-efficiency' | 'availability';
  weight: number;
  score: number;
  reason: string;
}

export interface Confidence {
  score: number;
  label: 'low' | 'medium' | 'high';
}

export interface SourceMetadata {
  provider: 'tiber-forge-bootstrap';
  version: string;
  mode: 'bootstrap-demo';
  deterministic: true;
  parityStatus: 'bootstrap-scaffold';
  generatedAt: string;
}

export interface EvaluateResponse {
  requestId: string;
  playerId: string;
  score: number;
  tier: 'core' | 'strong' | 'neutral' | 'avoid';
  rankingHint: number;
  components: ScoreComponent[];
  confidence: Confidence;
  reasons: string[];
  source: SourceMetadata;
  warnings: string[];
}

export interface RankingsRequest {
  requestId?: string;
  players: PlayerInput[];
  context: EvaluationContext;
  limit?: number;
  includeExplanations?: boolean;
}

export interface RankingsResponse {
  requestId: string;
  count: number;
  rankings: Array<{
    rank: number;
    evaluation: EvaluateResponse;
  }>;
  source: SourceMetadata;
  warnings: string[];
}

export interface ErrorEnvelope {
  error: {
    category: ErrorCategory;
    code: string;
    message: string;
    details?: unknown;
    traceId: string;
  };
}
