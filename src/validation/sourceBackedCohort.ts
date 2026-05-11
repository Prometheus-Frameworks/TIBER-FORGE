import {
  ForgePlayerWeeklyPprCohortMetadataV1,
  ForgePlayerWeeklyPprCohortV1,
  ForgePlayerWeeklyPprSeasonTotalV1,
  ForgePlayerWeeklyPprSourceMetadataV1,
  ForgePlayerWeeklyPprWeeklyRowV1,
  forgePlayerWeeklyPprCohortContract
} from '../contracts/sourceBackedCohort';
import { ValidationError } from '../contracts/validation';

const positions = ['QB', 'RB', 'WR', 'TE'] as const;
const forbiddenSemanticTerms = ['fixture', 'sample', 'offline', 'projection', 'projected'] as const;
const summableFields = [
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
type SummableField = (typeof summableFields)[number];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ensureString(value: unknown, path: string, errors: ErrorList): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${path} must be a non-empty string.`);
    return undefined;
  }
  return value;
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

function ensurePosition(value: unknown, path: string, errors: ErrorList): (typeof positions)[number] | undefined {
  if (typeof value !== 'string' || !positions.includes(value as (typeof positions)[number])) {
    errors.push(`${path} must be one of: ${positions.join(', ')}.`);
    return undefined;
  }
  return value as (typeof positions)[number];
}

function validateNoForbiddenSemantics(value: unknown, path: string, errors: ErrorList): void {
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    for (const term of forbiddenSemanticTerms) if (normalized.includes(term)) errors.push(`${path} must not contain ${term} semantics in a source-backed cohort artifact.`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateNoForbiddenSemantics(item, `${path}[${index}]`, errors));
    return;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase();
      for (const term of forbiddenSemanticTerms) if (normalizedKey.includes(term)) errors.push(`${path}.${key} must not use ${term} semantics in a source-backed cohort artifact.`);
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
  const generatedAt = value.generatedAt === undefined ? undefined : ensureIsoDate(value.generatedAt, `${path}.generatedAt`, errors);
  const buildId = value.buildId === undefined ? undefined : ensureString(value.buildId, `${path}.buildId`, errors);
  if (!provider) return undefined;
  return { ...value, provider, generatedAt, buildId };
}

function validateMetadata(value: unknown, path: string, errors: ErrorList): ForgePlayerWeeklyPprCohortMetadataV1 | undefined {
  if (!isObject(value)) {
    errors.push(`${path} must be an object.`);
    return undefined;
  }
  const contract = ensureString(value.contract, `${path}.contract`, errors);
  if (contract !== forgePlayerWeeklyPprCohortContract) errors.push(`${path}.contract must equal ${forgePlayerWeeklyPprCohortContract}.`);
  const season = ensureNumber(value.season, `${path}.season`, errors, { min: 2025, max: 2025, integer: true });
  const buildId = ensureString(value.buildId, `${path}.buildId`, errors);
  const generatedAt = value.generatedAt === undefined ? undefined : ensureIsoDate(value.generatedAt, `${path}.generatedAt`, errors);
  const source = validateSource(value.source, `${path}.source`, errors);
  const sourceProvider = value.sourceProvider === undefined ? source?.provider : ensureString(value.sourceProvider, `${path}.sourceProvider`, errors);
  if (sourceProvider && source?.provider && sourceProvider !== source.provider) errors.push(`${path}.sourceProvider must match ${path}.source.provider.`);
  if (contract !== forgePlayerWeeklyPprCohortContract || season !== 2025 || !buildId || !sourceProvider || !source) return undefined;
  return { contract: forgePlayerWeeklyPprCohortContract, season: 2025, buildId, generatedAt, sourceProvider, source };
}

function ensureOptionalStrings(value: unknown, path: string, errors: ErrorList): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    errors.push(`${path} must be an array of non-empty strings.`);
    return undefined;
  }
  return value;
}

function optionalStat(value: Record<string, unknown>, name: SummableField, path: string, errors: ErrorList, integer = true): number | undefined {
  if (value[name] === undefined) return undefined;
  return ensureNumber(value[name], `${path}.${name}`, errors, { min: 0, max: name === 'pprPoints' ? 700 : 10000, integer });
}

function validateWeeklyRow(value: unknown, path: string, errors: ErrorList, pprMax = 80): ForgePlayerWeeklyPprWeeklyRowV1 | undefined {
  if (!isObject(value)) {
    errors.push(`${path} must be an object.`);
    return undefined;
  }
  const playerId = ensureString(value.playerId, `${path}.playerId`, errors);
  const playerName = ensureString(value.playerName, `${path}.playerName`, errors);
  const position = ensurePosition(value.position, `${path}.position`, errors);
  const team = ensureString(value.team, `${path}.team`, errors);
  const season = ensureNumber(value.season, `${path}.season`, errors, { min: 2025, max: 2025, integer: true });
  const week = ensureNumber(value.week, `${path}.week`, errors, { min: 1, max: 25, integer: true });
  const source = validateSource(value.source, `${path}.source`, errors);
  const pprPoints = ensureNumber(value.pprPoints, `${path}.pprPoints`, errors, { min: 0, max: pprMax });
  const qualityFlags = ensureOptionalStrings(value.qualityFlags, `${path}.qualityFlags`, errors);
  if (!playerId || !playerName || !position || !team || season !== 2025 || week === undefined || !source || pprPoints === undefined) return undefined;
  return {
    playerId, playerName, position, team, season: 2025, week, source,
    games: optionalStat(value, 'games', path, errors),
    pprPoints,
    passingAttempts: optionalStat(value, 'passingAttempts', path, errors),
    passingYards: optionalStat(value, 'passingYards', path, errors),
    passingTd: optionalStat(value, 'passingTd', path, errors),
    interceptions: optionalStat(value, 'interceptions', path, errors),
    carries: optionalStat(value, 'carries', path, errors),
    targets: optionalStat(value, 'targets', path, errors),
    receptions: optionalStat(value, 'receptions', path, errors),
    rushingYards: optionalStat(value, 'rushingYards', path, errors),
    rushingTd: optionalStat(value, 'rushingTd', path, errors),
    receivingYards: optionalStat(value, 'receivingYards', path, errors),
    receivingTd: optionalStat(value, 'receivingTd', path, errors),
    totalTd: optionalStat(value, 'totalTd', path, errors),
    qualityFlags
  };
}

function validateSeasonTotal(value: unknown, path: string, errors: ErrorList): ForgePlayerWeeklyPprSeasonTotalV1 | undefined {
  const row = validateWeeklyRow(isObject(value) ? { ...value, week: 1 } : value, path, errors, 700);
  if (!row || !isObject(value)) return undefined;
  const games = ensureNumber(value.games, `${path}.games`, errors, { min: 0, max: 17, integer: true });
  const fantasyPointsPerGame = value.fantasyPointsPerGame === undefined ? undefined : ensureNumber(value.fantasyPointsPerGame, `${path}.fantasyPointsPerGame`, errors, { min: 0, max: 60 });
  const featureCoverage = value.featureCoverage === undefined ? undefined : ensureNumber(value.featureCoverage, `${path}.featureCoverage`, errors, { min: 0, max: 1 });
  if (games === undefined) return undefined;
  const { week: _week, ...total } = row;
  return { ...total, games, fantasyPointsPerGame, featureCoverage };
}

function rounded(value: number): number { return Math.round(value * 100) / 100; }

function sumWeekly(rows: ForgePlayerWeeklyPprWeeklyRowV1[], field: SummableField): number {
  if (field === 'games' && rows.every((row) => row.games === undefined)) return rows.length;
  return rounded(rows.reduce((sum, row) => sum + ((row[field] as number | undefined) ?? 0), 0));
}

function validateSeasonTotals(weeklyRows: ForgePlayerWeeklyPprWeeklyRowV1[], seasonTotals: ForgePlayerWeeklyPprSeasonTotalV1[], errors: ErrorList): void {
  const rowsByPlayer = new Map<string, ForgePlayerWeeklyPprWeeklyRowV1[]>();
  for (const row of weeklyRows) rowsByPlayer.set(row.playerId, [...(rowsByPlayer.get(row.playerId) ?? []), row]);
  for (const [index, total] of seasonTotals.entries()) {
    const rows = rowsByPlayer.get(total.playerId) ?? [];
    if (rows.length === 0) {
      errors.push(`seasonTotals[${index}] has no matching weeklyRows for playerId ${total.playerId}.`);
      continue;
    }
    for (const row of rows) if (row.playerName !== total.playerName || row.position !== total.position || row.team !== total.team) errors.push(`seasonTotals[${index}] identity fields must match all weeklyRows for playerId ${total.playerId}.`);
    for (const field of summableFields) {
      const expected = sumWeekly(rows, field);
      const actual = rounded((total[field] as number | undefined) ?? 0);
      if (Math.abs(actual - expected) > 0.01) errors.push(`seasonTotals[${index}].${field} (${actual}) must equal weeklyRows sum (${expected}) for playerId ${total.playerId}.`);
    }
  }
  for (const playerId of rowsByPlayer.keys()) if (!seasonTotals.some((total) => total.playerId === playerId)) errors.push(`weeklyRows for playerId ${playerId} must have a matching seasonTotals entry.`);
}

export function validateForgePlayerWeeklyPprCohortV1(value: unknown, path = 'sourceBackedCohort'): ForgePlayerWeeklyPprCohortV1 {
  const errors: ErrorList = [];
  validateNoForbiddenSemantics(value, path, errors);
  if (!isObject(value)) throw new ValidationError('SOURCE_BACKED_COHORT_INVALID_SHAPE', [`${path} must be an object.`], 'Source-backed cohort artifact validation failed.');
  const contract = ensureString(value.contract, `${path}.contract`, errors);
  if (contract !== forgePlayerWeeklyPprCohortContract) errors.push(`${path}.contract must equal ${forgePlayerWeeklyPprCohortContract}.`);
  const metadata = validateMetadata(value.metadata, `${path}.metadata`, errors);
  if (metadata && contract === forgePlayerWeeklyPprCohortContract && metadata.contract !== contract) errors.push(`${path}.metadata.contract must match ${path}.contract.`);
  if (!Array.isArray(value.weeklyRows) || value.weeklyRows.length === 0) errors.push(`${path}.weeklyRows must be a non-empty array.`);
  if (!Array.isArray(value.seasonTotals) || value.seasonTotals.length === 0) errors.push(`${path}.seasonTotals must be a non-empty array.`);
  const weeklyRows = Array.isArray(value.weeklyRows) ? value.weeklyRows.map((row, index) => validateWeeklyRow(row, `${path}.weeklyRows[${index}]`, errors)).filter((row): row is ForgePlayerWeeklyPprWeeklyRowV1 => Boolean(row)) : [];
  const seasonTotals = Array.isArray(value.seasonTotals) ? value.seasonTotals.map((row, index) => validateSeasonTotal(row, `${path}.seasonTotals[${index}]`, errors)).filter((row): row is ForgePlayerWeeklyPprSeasonTotalV1 => Boolean(row)) : [];
  validateSeasonTotals(weeklyRows, seasonTotals, errors);
  if (errors.length > 0 || contract !== forgePlayerWeeklyPprCohortContract || !metadata) throw new ValidationError('SOURCE_BACKED_COHORT_INVALID_SHAPE', errors, 'Source-backed cohort artifact validation failed.');
  return { contract: forgePlayerWeeklyPprCohortContract, metadata, weeklyRows, seasonTotals };
}
