import { ForgeSeasonPosition } from './football';

export const forgePlayerWeeklyPprCohortContract = 'forge_player_weekly_ppr_2025.cohort.v1' as const;
export const forgePlayerWeeklyPprCohortArtifactType = 'forge_player_weekly_ppr_2025_cohort' as const;

export interface ForgePlayerWeeklyPprSourceMetadataV1 {
  provider: string;
  [key: string]: unknown;
}

export interface ForgePlayerWeeklyPprCohortMetadataV1 {
  artifactId: string;
  artifactContract: typeof forgePlayerWeeklyPprCohortContract;
  schemaVersion: string;
  artifactType: string;
  season: 2025;
  buildId: string;
  asOf: string;
  sourceUpdatedAt: string;
  sourceProvider: string;
  source: ForgePlayerWeeklyPprSourceMetadataV1;
}

export interface ForgePlayerWeeklyPprStatsV1 {
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
  fantasyPointsPerGame?: number;
  featureCoverage?: number;
  qualityFlags?: string[];
}

export interface ForgePlayerWeeklyPprWeeklyRowV1 extends ForgePlayerWeeklyPprStatsV1 {
  playerId: string;
  playerName: string;
  position: ForgeSeasonPosition;
  team: string;
  season: 2025;
  week: number;
}

export interface ForgePlayerWeeklyPprSeasonTotalV1 extends ForgePlayerWeeklyPprStatsV1 {
  playerId: string;
  playerName: string;
  position: ForgeSeasonPosition;
  team: string;
  season: 2025;
  games: number;
}

export interface ForgePlayerWeeklyPprPlayerV1 {
  playerId: string;
  playerName: string;
  position: ForgeSeasonPosition;
  team: string;
  seasonTotal: ForgePlayerWeeklyPprSeasonTotalV1;
  weeklyRows: ForgePlayerWeeklyPprWeeklyRowV1[];
  qualityFlags?: string[];
}

export interface ForgePlayerWeeklyPprCohortV1 {
  artifactId: string;
  artifactContract: typeof forgePlayerWeeklyPprCohortContract;
  schemaVersion: string;
  artifactType: string;
  source: ForgePlayerWeeklyPprSourceMetadataV1;
  asOf: string;
  sourceUpdatedAt: string;
  buildId: string;
  season: 2025;
  metadata: ForgePlayerWeeklyPprCohortMetadataV1;
  players: ForgePlayerWeeklyPprPlayerV1[];
}

export interface SourceBackedCohortIngestionResult {
  artifactPath: string;
  metadata: ForgePlayerWeeklyPprCohortMetadataV1;
  inputs: import('./football').ForgeSeasonPlayerInputV1[];
}
