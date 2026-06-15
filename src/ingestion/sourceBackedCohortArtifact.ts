import { readFile } from 'node:fs/promises';
import { ForgeSeasonPlayerInputV1 } from '../contracts/football';
import { SourceBackedCohortIngestionResult } from '../contracts/sourceBackedCohort';
import { ValidationError } from '../contracts/validation';
import { validateForgePlayerWeeklyPprCohortV1 } from '../validation/sourceBackedCohort';

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function mergeQualityFlags(flags: Array<string[] | undefined>): string[] | undefined {
  const merged = [...new Set(flags.flatMap((items) => items ?? []))].sort();
  return merged.length > 0 ? merged : undefined;
}

export function toForgeSeasonInputsFromSourceBackedCohort(cohort: ReturnType<typeof validateForgePlayerWeeklyPprCohortV1>): ForgeSeasonPlayerInputV1[] {
  return cohort.players.map((player) => {
    const total = player.seasonTotal;
    const totalTd = total.totalTd ?? (total.passingTd ?? 0) + (total.rushingTd ?? 0) + (total.receivingTd ?? 0);
    const fantasyPointsPerGame = total.fantasyPointsPerGame ?? (total.games > 0 ? round(total.pprPoints / total.games) : 0);
    const weeklyRows = player.weeklyRows;

    return {
      contract: 'ForgeSeasonPlayerInput/v1',
      inputMode: 'source-backed-cohort',
      sourceBackedCohort: {
        artifactContract: cohort.artifactContract,
        buildId: cohort.metadata.buildId,
        sourceProvider: cohort.metadata.sourceProvider
      },
      playerId: total.playerId,
      playerName: total.playerName,
      position: total.position,
      team: total.team,
      season: total.season,
      games: total.games,
      pprPoints: total.pprPoints,
      fantasyPointsPerGame,
      passingAttempts: total.passingAttempts,
      passingYards: total.passingYards,
      passingTd: total.passingTd,
      interceptions: total.interceptions,
      carries: total.carries,
      targets: total.targets,
      receptions: total.receptions,
      rushingYards: total.rushingYards,
      rushingTd: total.rushingTd,
      receivingYards: total.receivingYards,
      receivingTd: total.receivingTd,
      totalTd,
      sourceSetId: cohort.metadata.buildId,
      sourceUpdatedAt: cohort.metadata.sourceUpdatedAt,
      asOf: cohort.metadata.asOf,
      featureCoverage: total.featureCoverage ?? 1,
      qualityFlags: mergeQualityFlags([player.qualityFlags, total.qualityFlags, ...weeklyRows.map((row) => row.qualityFlags)])
    };
  });
}

export async function ingestSourceBackedCohortArtifact(artifactPath: string): Promise<SourceBackedCohortIngestionResult> {
  let raw: string;
  try {
    raw = await readFile(artifactPath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ValidationError('SOURCE_BACKED_COHORT_READ_FAILED', [message], `Failed to read source-backed TIBER-Data cohort artifact at path: ${artifactPath}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError('SOURCE_BACKED_COHORT_INVALID_JSON', [`Artifact at path ${artifactPath} is not valid JSON.`], `Malformed source-backed TIBER-Data cohort artifact at path: ${artifactPath}.`);
  }

  try {
    const cohort = validateForgePlayerWeeklyPprCohortV1(parsed);
    return {
      artifactPath,
      metadata: cohort.metadata,
      inputs: toForgeSeasonInputsFromSourceBackedCohort(cohort)
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new ValidationError(error.code, error.details, `Invalid source-backed TIBER-Data cohort artifact at path: ${artifactPath}.`);
    }
    throw error;
  }
}
