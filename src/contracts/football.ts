import { EvaluationContext, InjuryStatus } from './forge';

export type PracticeParticipation = 'full' | 'limited' | 'did_not_practice' | 'none';
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
  activeProjection?: number;
  roleVolatility?: number;
  sourceUpdatedAt: string;
  sourceSetId: string;
  featureCoverage: number;
  qualityFlags?: string[];
  dataConfidenceHint?: string;
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

export interface FootballArtifactRankingsRequest {
  requestId?: string;
  artifactKind?: 'sample' | 'derived_qb' | 'derived_skill';
  artifactWeek?: number;
  context?: EvaluationContext;
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

export type ForgeSeasonPosition = 'QB' | 'RB' | 'WR' | 'TE';
export type ForgeSeasonFixtureSemantics = 'sample-only-retrospective-fixture';
export type ForgeSeasonInputMode = 'fixture' | 'source-backed-cohort';
export type ForgeSeasonGradeTier = 'elite' | 'high' | 'solid' | 'volatile' | 'low';
export type ForgeSeasonConfidenceLabel = 'high' | 'medium' | 'low';
export type ForgeSeasonComponentKey = 'realized_ppr' | 'volume' | 'efficiency' | 'availability' | 'fragility';

export interface ForgeSeasonPlayerInputV1 {
  contract: 'ForgeSeasonPlayerInput/v1';
  fixtureSemantics?: ForgeSeasonFixtureSemantics;
  inputMode?: ForgeSeasonInputMode;
  sourceBackedCohort?: {
    artifactContract: `forge_player_weekly_ppr_${number}.cohort.v1`;
    buildId: string;
    sourceProvider: string;
  };
  playerId: string;
  playerName: string;
  position: ForgeSeasonPosition;
  team: string;
  season: number;
  games: number;
  pprPoints: number;
  fantasyPointsPerGame: number;
  passingAttempts?: number;
  passingYards?: number;
  passingTd?: number;
  interceptions?: number;
  carries?: number;
  targets?: number;
  receptions?: number;
  rushingYards?: number;
  rushingTd?: number;
  receivingYards?: number;
  receivingTd?: number;
  totalTd: number;
  sourceSetId: string;
  sourceUpdatedAt: string;
  asOf: string;
  featureCoverage: number;
  qualityFlags?: string[];
  sampleNote?: string;
}

export interface ForgeSeasonComponentGrade {
  key: ForgeSeasonComponentKey;
  label: string;
  weight: number;
  score: number;
  reason: string;
}

export interface ForgeSeasonPlayerGrade {
  rank?: number;
  player: {
    playerId: string;
    playerName: string;
    position: ForgeSeasonPosition;
    team: string;
  };
  score: number;
  tier: ForgeSeasonGradeTier;
  components: ForgeSeasonComponentGrade[];
  confidence: {
    score: number;
    label: ForgeSeasonConfidenceLabel;
    deterministic: true;
    reason: string;
  };
  warnings: string[];
}

export interface ForgeSeasonRankingsResult {
  season: number;
  sourceSetId: string;
  inputMode?: ForgeSeasonInputMode;
  cohortMetadata?: {
    artifactPath?: string;
    buildId: string;
    sourceProvider: string;
    playerCount: number;
    season: number;
  };
  count: number;
  rankings: ForgeSeasonPlayerGrade[];
  warnings: string[];
}
