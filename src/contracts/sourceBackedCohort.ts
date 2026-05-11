import { ForgeSeasonPosition } from './football';

export const forgePlayerWeeklyPprCohortContract = 'forge_player_weekly_ppr_2025.cohort.v1' as const;

export interface ForgePlayerWeeklyPprSourceMetadataV1 {
  provider: string;
  generatedAt?: string;
  buildId?: string;
  [key: string]: unknown;
}

export interface ForgePlayerWeeklyPprCohortMetadataV1 {
  contract: typeof forgePlayerWeeklyPprCohortContract;
  season: 2025;
  buildId: string;
  generatedAt?: string;
  sourceProvider: string;
  source: ForgePlayerWeeklyPprSourceMetadataV1;
}

export interface ForgePlayerWeeklyPprWeeklyRowV1 {
  playerId: string;
  playerName: string;
  position: ForgeSeasonPosition;
  team: string;
  season: 2025;
  week: number;
  source: ForgePlayerWeeklyPprSourceMetadataV1;
  games?: number;
  pprPoints: number;
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
  totalTd?: number;
  qualityFlags?: string[];
}

export interface ForgePlayerWeeklyPprSeasonTotalV1 extends Omit<ForgePlayerWeeklyPprWeeklyRowV1, 'week'> {
  games: number;
  fantasyPointsPerGame?: number;
  featureCoverage?: number;
}

export interface ForgePlayerWeeklyPprCohortV1 {
  contract: typeof forgePlayerWeeklyPprCohortContract;
  metadata: ForgePlayerWeeklyPprCohortMetadataV1;
  weeklyRows: ForgePlayerWeeklyPprWeeklyRowV1[];
  seasonTotals: ForgePlayerWeeklyPprSeasonTotalV1[];
}

export interface SourceBackedCohortIngestionResult {
  artifactPath: string;
  metadata: ForgePlayerWeeklyPprCohortMetadataV1;
  inputs: import('./football').ForgeSeasonPlayerInputV1[];
}
