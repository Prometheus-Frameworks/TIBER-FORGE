export const allowedPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL'] as const;
export const allowedContestTypes = ['cash', 'tournament', 'simulation'] as const;
export const allowedModes = ['bootstrap-demo'] as const;
export const allowedInjuryStatuses = ['healthy', 'questionable', 'doubtful', 'out'] as const;
export const allowedErrorCategories = ['VALIDATION_ERROR', 'CONFIG_ERROR', 'NOT_READY', 'NOT_FOUND', 'INTERNAL_ERROR'] as const;
export const allowedConfidenceLabels = ['low', 'medium', 'high'] as const;
export const allowedTiers = ['core', 'strong', 'neutral', 'avoid'] as const;
export const allowedComponentKeys = ['opportunity', 'recent_form', 'salary_efficiency', 'availability'] as const;

export type Position = (typeof allowedPositions)[number];
export type ContestType = (typeof allowedContestTypes)[number];
export type ForgeMode = (typeof allowedModes)[number];
export type InjuryStatus = (typeof allowedInjuryStatuses)[number];
export type ErrorCategory = (typeof allowedErrorCategories)[number];
export type ConfidenceLabel = (typeof allowedConfidenceLabels)[number];
export type EvaluationTier = (typeof allowedTiers)[number];
export type ScoreComponentKey = (typeof allowedComponentKeys)[number];

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

export interface EvaluatedPlayer {
  playerId: string;
  playerName: string;
  team: string;
  opponent: string;
  position: Position;
  salary?: number;
}

export interface ScoreComponent {
  key: ScoreComponentKey;
  label: string;
  weight: number;
  score: number;
  reason: string;
}

export interface EvaluationScore {
  overall: number;
  tier: EvaluationTier;
  rankHint: number;
  components: ScoreComponent[];
}

export interface Confidence {
  score: number;
  label: ConfidenceLabel;
  deterministic: true;
  reason: string;
}

export interface EvaluationMetadata {
  slateId: string;
  slateDate: string;
  sport: string;
  site: string;
  contestType: ContestType;
  mode: ForgeMode;
  injuryStatus: InjuryStatus;
  tags: string[];
  bootstrap: true;
}

export interface SourceMetadata {
  provider: 'tiber-forge-bootstrap';
  version: string;
  mode: 'bootstrap-demo';
  deterministic: true;
  parityStatus: 'bootstrap-scaffold';
  specAlignment: 'pr72-transition';
  generatedAt: string;
}

export interface EvaluateResponse {
  requestId: string;
  player: EvaluatedPlayer;
  score: EvaluationScore;
  confidence: Confidence;
  reasons: string[];
  metadata: EvaluationMetadata;
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

export interface RankedEvaluation extends EvaluateResponse {
  rank: number;
}

export interface RankingsMetadata {
  totalCandidates: number;
  returnedCount: number;
  limitApplied: number | null;
  includeExplanations: boolean;
}

export interface RankingsResponse {
  requestId: string;
  count: number;
  rankings: RankedEvaluation[];
  metadata: RankingsMetadata;
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
