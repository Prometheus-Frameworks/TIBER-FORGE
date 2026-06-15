import {
  ForgePlayerWeeklyPprCohortMetadataV1,
  ForgePlayerWeeklyPprCohortV1,
  ForgePlayerWeeklyPprPlayerV1,
  ForgePlayerWeeklyPprSeasonTotalV1,
  ForgePlayerWeeklyPprSourceMetadataV1,
  ForgePlayerWeeklyPprStatsV1,
  ForgePlayerWeeklyPprWeeklyRowV1,
  forgePlayerWeeklyPprCohortContractForSeason
} from '../contracts/sourceBackedCohort';
import { ForgeSeasonPosition } from '../contracts/football';
import { ValidationError } from '../contracts/validation';

const supportedSeasonBounds = { min: 2025, max: 2035, integer: true } as const;

const positions = ['QB', 'RB', 'WR', 'TE'] as const;
const forbiddenSemanticTerms = ['fixture', 'sample', 'offline', 'projection', 'projected'] as const;
const statFields = [
  'games',
  'pprPoints',
  'passingAttempts',
  'passingYards',
  'passingTd',
  'interceptions',
  'carries',
  'targets',
  'receptions',
  'rushingYards',
  'rushingTd',
  'receivingYards',
  'receivingTd',
  'totalTd'
] as const;

type ErrorList = string[];
type StatField = (typeof statFields)[number];

type FieldAlias = readonly string[];
const aliases: Record<StatField, FieldAlias> = {
  games: ['games', 'gamesPlayed'],
  pprPoints: ['pprPoints', 'fantasyPointsPpr', 'fantasyPointsPPR', 'pointsPpr', 'pointsPPR', 'ppr'],
  passingAttempts: ['passingAttempts', 'passAttempts', 'attempts'],
  passingYards: ['passingYards', 'passYards'],
  passingTd: ['passingTd', 'passingTD', 'passingTouchdowns', 'passTd', 'passTD'],
  interceptions: ['interceptions', 'passingInterceptions'],
  carries: ['carries', 'rushingAttempts', 'rushAttempts'],
  targets: ['targets'],
  receptions: ['receptions', 'catches'],
  rushingYards: ['rushingYards', 'rushYards'],
  rushingTd: ['rushingTd', 'rushingTD', 'rushingTouchdowns', 'rushTd', 'rushTD'],
  receivingYards: ['receivingYards', 'recYards'],
  receivingTd: ['receivingTd', 'receivingTD', 'receivingTouchdowns', 'recTd', 'recTD'],
  totalTd: ['totalTd', 'totalTD', 'totalTouchdowns', 'touchdowns']
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstPresent(value: Record<string, unknown>, names: FieldAlias): unknown {
  for (const name of names) {
    if (value[name] !== undefined) return value[name];
  }
  return undefined;
}

function ensureString(value: unknown, path: string, errors: ErrorList): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${path} must be a non-empty string.`);
    return undefined;
  }
  return value;
}

function optionalString(value: unknown, path: string, errors: ErrorList): string | undefined {
  return value === undefined ? undefined : ensureString(value, path, errors);
}

function ensureNumber(value: unknown, path: string, errors: ErrorList, options: { min?: number; max?: number; integer?: boolean } = {}): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    errors.push(`${path} must be a valid number.`);
    return undefined;
  }
  if (options.integer && !Number.isInteger(value)) errors.push(`${path} must be an integer.`);
  if (options.min !== undefined && value < options.min) errors.push(`${path} must be >= ${options.min}.`);
  if (options.max !== undefined && value > options.max) errors.push(`${path} must be <= ${options.max}.`);
  return value;
}

function ensureIsoDate(value: unknown, path: string, errors: ErrorList): string | undefined {
  const stringValue = ensureString(value, path, errors);
  if (!stringValue) return undefined;
  if (Number.isNaN(Date.parse(stringValue))) errors.push(`${path} must be an ISO-8601 datetime string.`);
  return stringValue;
}

function ensurePosition(value: unknown, path: string, errors: ErrorList): ForgeSeasonPosition | undefined {
  if (typeof value !== 'string' || !positions.includes(value as (typeof positions)[number])) {
    errors.push(`${path} must be one of: ${positions.join(', ')}.`);
    return undefined;
  }
  return value as ForgeSeasonPosition;
}

function ensureOptionalStrings(value: unknown, path: string, errors: ErrorList): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    errors.push(`${path} must be an array of non-empty strings.`);
    return undefined;
  }
  return value;
}

function validateNoForbiddenSemantics(value: unknown, path: string, errors: ErrorList): void {
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    for (const term of forbiddenSemanticTerms) {
      if (normalized.includes(term)) errors.push(`${path} must not contain ${term} semantics in a source-backed cohort artifact.`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateNoForbiddenSemantics(item, `${path}[${index}]`, errors));
    return;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase();
      for (const term of forbiddenSemanticTerms) {
        if (normalizedKey.includes(term)) errors.push(`${path}.${key} must not use ${term} semantics in a source-backed cohort artifact.`);
      }
      validateNoForbiddenSemantics(child, `${path}.${key}`, errors);
    }
  }
}

function validateSource(value: unknown, path: string, errors: ErrorList): ForgePlayerWeeklyPprSourceMetadataV1 | undefined {
  if (!isObject(value)) {
    errors.push(`${path} must be an object with source provider metadata.`);
    return undefined;
  }
  const provider = ensureString(value.provider, `${path}.provider`, errors);
  if (!provider) return undefined;
  return { ...value, provider };
}

function statValue(value: Record<string, unknown>, field: StatField, path: string, errors: ErrorList, required = false): number | undefined {
  const raw = firstPresent(value, aliases[field]);
  if (raw === undefined) {
    if (required) errors.push(`${path}.${field} must be present.`);
    return undefined;
  }
  return ensureNumber(raw, `${path}.${field}`, errors, { min: 0, max: field === 'pprPoints' ? 700 : 10000, integer: field !== 'pprPoints' });
}

function parseStats(value: Record<string, unknown>, path: string, errors: ErrorList, requireGames: boolean): ForgePlayerWeeklyPprStatsV1 | undefined {
  const pprPoints = statValue(value, 'pprPoints', path, errors, true);
  const games = statValue(value, 'games', path, errors, requireGames);
  const qualityFlags = ensureOptionalStrings(value.qualityFlags, `${path}.qualityFlags`, errors);
  const fantasyPointsPerGame = value.fantasyPointsPerGame === undefined ? undefined : ensureNumber(value.fantasyPointsPerGame, `${path}.fantasyPointsPerGame`, errors, { min: 0, max: 60 });
  const featureCoverage = value.featureCoverage === undefined ? undefined : ensureNumber(value.featureCoverage, `${path}.featureCoverage`, errors, { min: 0, max: 1 });

  if (pprPoints === undefined || (requireGames && games === undefined)) return undefined;

  return {
    games,
    pprPoints,
    passingAttempts: statValue(value, 'passingAttempts', path, errors),
    passingYards: statValue(value, 'passingYards', path, errors),
    passingTd: statValue(value, 'passingTd', path, errors),
    interceptions: statValue(value, 'interceptions', path, errors),
    carries: statValue(value, 'carries', path, errors),
    targets: statValue(value, 'targets', path, errors),
    receptions: statValue(value, 'receptions', path, errors),
    rushingYards: statValue(value, 'rushingYards', path, errors),
    rushingTd: statValue(value, 'rushingTd', path, errors),
    receivingYards: statValue(value, 'receivingYards', path, errors),
    receivingTd: statValue(value, 'receivingTd', path, errors),
    totalTd: statValue(value, 'totalTd', path, errors),
    fantasyPointsPerGame,
    featureCoverage,
    qualityFlags
  };
}

function validateMetadata(value: Record<string, unknown>, path: string, errors: ErrorList): ForgePlayerWeeklyPprCohortMetadataV1 | undefined {
  const artifactId = ensureString(value.artifactId, `${path}.artifactId`, errors);
  const schemaVersion = ensureString(value.schemaVersion, `${path}.schemaVersion`, errors);
  const artifactType = ensureString(value.artifactType, `${path}.artifactType`, errors);
  const season = ensureNumber(value.season, `${path}.season`, errors, supportedSeasonBounds);
  const buildId = ensureString(value.buildId, `${path}.buildId`, errors);
  const asOf = ensureIsoDate(value.asOf, `${path}.asOf`, errors);
  const sourceUpdatedAt = ensureIsoDate(value.sourceUpdatedAt, `${path}.sourceUpdatedAt`, errors);
  const source = validateSource(value.source, `${path}.source`, errors);

  if (!artifactId || !schemaVersion || !artifactType || season === undefined || !buildId || !asOf || !sourceUpdatedAt || !source) return undefined;
  return { artifactId, artifactContract: forgePlayerWeeklyPprCohortContractForSeason(season), schemaVersion, artifactType, season, buildId, asOf, sourceUpdatedAt, sourceProvider: source.provider, source };
}

function readPlayerIdentity(player: Record<string, unknown>, path: string, errors: ErrorList, cohortSeason: number): { playerId?: string; playerName?: string; position?: ForgeSeasonPosition; team?: string; season?: number } {
  return {
    playerId: ensureString(player.playerId ?? player.id, `${path}.playerId`, errors),
    playerName: ensureString(player.playerName ?? player.name ?? player.fullName, `${path}.playerName`, errors),
    position: ensurePosition(player.position, `${path}.position`, errors),
    team: ensureString(player.team ?? player.recentTeam, `${path}.team`, errors),
    season: player.season === undefined ? cohortSeason : ensureNumber(player.season, `${path}.season`, errors, supportedSeasonBounds)
  };
}

function validateWeeklyRow(value: unknown, path: string, identity: Required<ReturnType<typeof readPlayerIdentity>>, errors: ErrorList): ForgePlayerWeeklyPprWeeklyRowV1 | undefined {
  if (!isObject(value)) {
    errors.push(`${path} must be an object.`);
    return undefined;
  }
  const week = ensureNumber(value.week, `${path}.week`, errors, { min: 1, max: 25, integer: true });
  const season = value.season === undefined ? identity.season : ensureNumber(value.season, `${path}.season`, errors, supportedSeasonBounds);
  const stats = parseStats(value, path, errors, false);
  if (week === undefined || season === undefined || !stats) return undefined;
  return { ...stats, ...identity, season, week };
}

function validateSeasonTotal(value: unknown, path: string, identity: Required<ReturnType<typeof readPlayerIdentity>>, errors: ErrorList): ForgePlayerWeeklyPprSeasonTotalV1 | undefined {
  if (!isObject(value)) {
    errors.push(`${path} must be an object.`);
    return undefined;
  }
  const season = value.season === undefined ? identity.season : ensureNumber(value.season, `${path}.season`, errors, supportedSeasonBounds);
  const stats = parseStats(value, path, errors, true);
  if (season === undefined || !stats || stats.games === undefined) return undefined;
  return { ...stats, ...identity, season, games: stats.games };
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function sumWeekly(rows: ForgePlayerWeeklyPprWeeklyRowV1[], field: StatField): number {
  if (field === 'games' && rows.every((row) => row.games === undefined)) return rows.length;
  return rounded(rows.reduce((sum, row) => sum + ((row[field] as number | undefined) ?? 0), 0));
}

function validateSeasonTotalSums(player: ForgePlayerWeeklyPprPlayerV1, path: string, errors: ErrorList): void {
  for (const field of statFields) {
    const expected = sumWeekly(player.weeklyRows, field);
    const actual = rounded((player.seasonTotal[field] as number | undefined) ?? 0);
    if (Math.abs(actual - expected) > 0.01) errors.push(`${path}.seasonTotal.${field} (${actual}) must equal weeklyRows sum (${expected}) for playerId ${player.playerId}.`);
  }
}

function validatePlayer(value: unknown, path: string, errors: ErrorList, cohortSeason: number): ForgePlayerWeeklyPprPlayerV1 | undefined {
  if (!isObject(value)) {
    errors.push(`${path} must be an object.`);
    return undefined;
  }
  const identity = readPlayerIdentity(value, path, errors, cohortSeason);
  if (!identity.playerId || !identity.playerName || !identity.position || !identity.team) return undefined;
  const requiredIdentity = identity as Required<typeof identity>;
  if (!Array.isArray(value.weeklyRows) || value.weeklyRows.length === 0) errors.push(`${path}.weeklyRows must be a non-empty array.`);
  const seasonTotal = validateSeasonTotal(value.seasonTotal, `${path}.seasonTotal`, requiredIdentity, errors);
  const weeklyRows = Array.isArray(value.weeklyRows)
    ? value.weeklyRows.map((row, index) => validateWeeklyRow(row, `${path}.weeklyRows[${index}]`, requiredIdentity, errors)).filter((row): row is ForgePlayerWeeklyPprWeeklyRowV1 => Boolean(row))
    : [];
  const qualityFlags = ensureOptionalStrings(value.qualityFlags, `${path}.qualityFlags`, errors);

  if (!seasonTotal) return undefined;
  const player = { ...requiredIdentity, seasonTotal, weeklyRows, qualityFlags };
  validateSeasonTotalSums(player, path, errors);
  return player;
}

export function validateForgePlayerWeeklyPprCohortV1(value: unknown, path = 'sourceBackedCohort'): ForgePlayerWeeklyPprCohortV1 {
  const errors: ErrorList = [];
  validateNoForbiddenSemantics(value, path, errors);
  if (!isObject(value)) throw new ValidationError('SOURCE_BACKED_COHORT_INVALID_SHAPE', [`${path} must be an object.`], 'Source-backed cohort artifact validation failed.');

  const metadata = validateMetadata(value, path, errors);
  if (!Array.isArray(value.players) || value.players.length === 0) errors.push(`${path}.players must be a non-empty array.`);
  const players = Array.isArray(value.players)
    ? value.players.map((player, index) => validatePlayer(player, `${path}.players[${index}]`, errors, metadata?.season ?? 2025)).filter((player): player is ForgePlayerWeeklyPprPlayerV1 => Boolean(player))
    : [];

  if (errors.length > 0 || !metadata) throw new ValidationError('SOURCE_BACKED_COHORT_INVALID_SHAPE', errors, 'Source-backed cohort artifact validation failed.');
  return {
    artifactId: metadata.artifactId,
    artifactContract: metadata.artifactContract,
    schemaVersion: metadata.schemaVersion,
    artifactType: metadata.artifactType,
    source: metadata.source,
    asOf: metadata.asOf,
    sourceUpdatedAt: metadata.sourceUpdatedAt,
    buildId: metadata.buildId,
    season: metadata.season,
    metadata,
    players
  };
}
