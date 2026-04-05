import { EvaluationContext, InjuryStatus } from './forge';

export type PracticeParticipation = 'full' | 'limited' | 'did_not_practice' | 'none';
export type ActiveProjection = 'active' | 'game_time_decision' | 'inactive' | 'unknown';
export type DataConfidenceHint = 'high' | 'medium' | 'low' | 'unknown';
export type OpponentDefenseTier = 'elite' | 'strong' | 'neutral' | 'weak';
export type ExpectedGameScript = 'positive' | 'neutral' | 'negative';

export interface ForgeWeeklyPlayerInput {
  playerId: string;
  externalPlayerIds?: {
    gsisId?: string;
    pfrId?: string;
    sleeperId?: string;
  };
  playerName: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  opponent?: string;
  season: number;
  week: number;
  asOf: string;
  snaps?: number;
  snapShare?: number;
  routesRun?: number;
  routeParticipation?: number;
  rushAttempts?: number;
  targets?: number;
  redZoneTouches?: number;
  goalLineTouches?: number;
  yardsPerRouteRun?: number;
  yardsPerCarry?: number;
  catchRate?: number;
  fantasyPointsPerOpportunity?: number;
  explosivePlayRate?: number;
  impliedTeamTotal?: number;
  spread?: number;
  paceProxy?: number;
  opponentDefenseTier?: OpponentDefenseTier;
  expectedGameScript?: ExpectedGameScript;
  injuryStatus?: InjuryStatus;
  practiceParticipation?: PracticeParticipation;
  activeProjection?: ActiveProjection;
  roleVolatility?: number;
  sourceUpdatedAt: string;
  sourceSetId: string;
  featureCoverage: number;
  qualityFlags?: string[];
  dataConfidenceHint?: DataConfidenceHint;
}

export interface FootballEvaluateRequest {
  requestId?: string;
  input: ForgeWeeklyPlayerInput;
  context: EvaluationContext;
}

export interface FootballRankingsRequest {
  requestId?: string;
  inputs: ForgeWeeklyPlayerInput[];
  context: EvaluationContext;
  limit?: number;
  includeExplanations?: boolean;
}

export interface NormalizedFootballScoringInput {
  playerId: string;
  playerName: string;
  team: string;
  opponent: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  injuryStatus: InjuryStatus;
  tags: string[];
  supportFlags: string[];
  opportunity: {
    snapShare: number;
    routeParticipation: number;
    rushAttempts: number;
    targets: number;
    redZoneTouches: number;
    goalLineTouches: number;
  };
  efficiency: {
    yardsPerRouteRun: number;
    yardsPerCarry: number;
    catchRate: number;
    fantasyPointsPerOpportunity: number;
    explosivePlayRate: number;
  };
  environment: {
    impliedTeamTotal: number;
    spread: number;
    opponentDefenseTier: OpponentDefenseTier;
    expectedGameScript: ExpectedGameScript;
  };
  stability: {
    practiceParticipation: PracticeParticipation;
    activeProjection: 'expected_active' | 'risky' | 'expected_inactive';
    roleVolatility: number;
    featureCoverage: number;
    dataConfidenceHint: number;
  };
  provenance: {
    sourceSetId: string;
    sourceUpdatedAt: string;
    asOf: string;
    season: number;
    week: number;
  };
}
