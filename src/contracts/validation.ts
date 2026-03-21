import {
  allowedComponentKeys,
  allowedConfidenceLabels,
  allowedContestTypes,
  allowedErrorCategories,
  allowedInjuryStatuses,
  allowedModes,
  allowedPositions,
  allowedTiers,
  ErrorEnvelope,
  EvaluateRequest,
  EvaluateResponse,
  EvaluationContext,
  EvaluationMetadata,
  PlayerInput,
  RankingsRequest,
  RankingsResponse,
  ScoreComponent,
  SourceMetadata
} from './forge';

export class ValidationError extends Error {
  constructor(
    public readonly code: string,
    public readonly details: unknown,
    message = 'Request validation failed.'
  ) {
    super(message);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ensureString(value: unknown, path: string, errors: string[]): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${path} must be a non-empty string.`);
    return undefined;
  }
  return value;
}

function ensureBoolean(value: unknown, path: string, errors: string[]): boolean | undefined {
  if (typeof value !== 'boolean') {
    errors.push(`${path} must be a boolean.`);
    return undefined;
  }
  return value;
}

function ensureNumber(value: unknown, path: string, errors: string[], options: { min?: number; max?: number; integer?: boolean } = {}): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    errors.push(`${path} must be a valid number.`);
    return undefined;
  }
  if (options.integer && !Number.isInteger(value)) {
    errors.push(`${path} must be an integer.`);
  }
  if (options.min !== undefined && value < options.min) {
    errors.push(`${path} must be >= ${options.min}.`);
  }
  if (options.max !== undefined && value > options.max) {
    errors.push(`${path} must be <= ${options.max}.`);
  }
  return value;
}

function ensureArrayOfStrings(value: unknown, path: string, errors: string[]): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    errors.push(`${path} must be an array of non-empty strings.`);
    return [];
  }
  return value;
}

function ensureEnum<T extends readonly string[]>(value: unknown, options: T, path: string, errors: string[]): T[number] | undefined {
  if (typeof value !== 'string' || !options.includes(value)) {
    errors.push(`${path} must be one of: ${options.join(', ')}.`);
    return undefined;
  }
  return value as T[number];
}

function ensureIsoDate(value: unknown, path: string, errors: string[]): string | undefined {
  const stringValue = ensureString(value, path, errors);
  if (!stringValue) {
    return undefined;
  }
  if (Number.isNaN(Date.parse(stringValue))) {
    errors.push(`${path} must be an ISO-8601 datetime string.`);
    return undefined;
  }
  return stringValue;
}

function validatePlayer(value: unknown, path: string, errors: string[]): PlayerInput | undefined {
  if (!isObject(value)) {
    errors.push(`${path} must be an object.`);
    return undefined;
  }

  const playerId = ensureString(value.playerId, `${path}.playerId`, errors);
  const playerName = ensureString(value.playerName, `${path}.playerName`, errors);
  const team = ensureString(value.team, `${path}.team`, errors);
  const opponent = ensureString(value.opponent, `${path}.opponent`, errors);
  const position = ensureEnum(value.position, allowedPositions, `${path}.position`, errors);
  const injuryStatus = ensureEnum(value.injuryStatus ?? 'healthy', allowedInjuryStatuses, `${path}.injuryStatus`, errors);
  const tags = ensureArrayOfStrings(value.tags ?? [], `${path}.tags`, errors);

  const salary = value.salary === undefined ? undefined : ensureNumber(value.salary, `${path}.salary`, errors, { min: 1, integer: true });
  const projectedMinutes =
    value.projectedMinutes === undefined ? undefined : ensureNumber(value.projectedMinutes, `${path}.projectedMinutes`, errors, { min: 0, max: 60 });
  const recentFantasyPoints =
    value.recentFantasyPoints === undefined ? undefined : ensureNumber(value.recentFantasyPoints, `${path}.recentFantasyPoints`, errors, { min: 0, max: 200 });

  if (!playerId || !playerName || !team || !opponent || !position || !injuryStatus) {
    return undefined;
  }

  return {
    playerId,
    playerName,
    team,
    opponent,
    position,
    salary,
    projectedMinutes,
    recentFantasyPoints,
    injuryStatus,
    tags
  };
}

function validateContext(value: unknown, path: string, errors: string[]): EvaluationContext | undefined {
  if (!isObject(value)) {
    errors.push(`${path} must be an object.`);
    return undefined;
  }

  const slateId = ensureString(value.slateId, `${path}.slateId`, errors);
  const slateDate = ensureIsoDate(value.slateDate, `${path}.slateDate`, errors);
  const sport = ensureString(value.sport, `${path}.sport`, errors);
  const site = ensureString(value.site, `${path}.site`, errors);
  const contestType = ensureEnum(value.contestType ?? 'simulation', allowedContestTypes, `${path}.contestType`, errors);
  const mode = ensureEnum(value.mode ?? 'bootstrap-demo', allowedModes, `${path}.mode`, errors);

  if (!slateId || !slateDate || !sport || !site || !contestType || !mode) {
    return undefined;
  }

  return { slateId, slateDate, sport, site, contestType, mode };
}

export function validateEvaluateRequest(value: unknown): EvaluateRequest {
  const errors: string[] = [];
  if (!isObject(value)) {
    throw new ValidationError('INVALID_REQUEST_BODY', ['Body must be a JSON object.']);
  }

  const requestId = value.requestId === undefined ? undefined : ensureString(value.requestId, 'requestId', errors);
  const player = validatePlayer(value.player, 'player', errors);
  const context = validateContext(value.context, 'context', errors);

  if (errors.length > 0 || !player || !context) {
    throw new ValidationError('INVALID_REQUEST_BODY', errors);
  }

  return { requestId, player, context };
}

export function validateRankingsRequest(value: unknown): RankingsRequest {
  const errors: string[] = [];
  if (!isObject(value)) {
    throw new ValidationError('INVALID_REQUEST_BODY', ['Body must be a JSON object.']);
  }

  const requestId = value.requestId === undefined ? undefined : ensureString(value.requestId, 'requestId', errors);
  const context = validateContext(value.context, 'context', errors);
  const includeExplanations = value.includeExplanations === undefined ? true : ensureBoolean(value.includeExplanations, 'includeExplanations', errors);

  if (!Array.isArray(value.players) || value.players.length === 0 || value.players.length > 100) {
    errors.push('players must be an array containing between 1 and 100 players.');
  }

  const players = Array.isArray(value.players)
    ? value.players
        .map((player, index) => validatePlayer(player, `players[${index}]`, errors))
        .filter((player): player is PlayerInput => Boolean(player))
    : [];

  const limit = value.limit === undefined ? undefined : ensureNumber(value.limit, 'limit', errors, { min: 1, max: 100, integer: true });

  if (errors.length > 0 || !context || includeExplanations === undefined) {
    throw new ValidationError('INVALID_REQUEST_BODY', errors);
  }

  return { requestId, players, context, limit, includeExplanations };
}

function validateScoreComponent(component: unknown, path: string, errors: string[]): component is ScoreComponent {
  if (!isObject(component)) {
    errors.push(`${path} must be an object.`);
    return false;
  }
  ensureEnum(component.key, allowedComponentKeys, `${path}.key`, errors);
  ensureString(component.label, `${path}.label`, errors);
  ensureNumber(component.weight, `${path}.weight`, errors, { min: 0, max: 1 });
  ensureNumber(component.score, `${path}.score`, errors, { min: 0, max: 100 });
  ensureString(component.reason, `${path}.reason`, errors);
  return true;
}

function validateMetadata(metadata: unknown, path: string, errors: string[]): metadata is EvaluationMetadata {
  if (!isObject(metadata)) {
    errors.push(`${path} must be an object.`);
    return false;
  }

  ensureString(metadata.slateId, `${path}.slateId`, errors);
  ensureIsoDate(metadata.slateDate, `${path}.slateDate`, errors);
  ensureString(metadata.sport, `${path}.sport`, errors);
  ensureString(metadata.site, `${path}.site`, errors);
  ensureEnum(metadata.contestType, allowedContestTypes, `${path}.contestType`, errors);
  ensureEnum(metadata.mode, allowedModes, `${path}.mode`, errors);
  ensureEnum(metadata.injuryStatus, allowedInjuryStatuses, `${path}.injuryStatus`, errors);
  ensureArrayOfStrings(metadata.tags, `${path}.tags`, errors);
  if (metadata.bootstrap !== true) {
    errors.push(`${path}.bootstrap must be true.`);
  }
  return true;
}

function validateSourceMetadata(source: unknown, path: string, errors: string[]): source is SourceMetadata {
  if (!isObject(source)) {
    errors.push(`${path} must be an object.`);
    return false;
  }
  ensureString(source.provider, `${path}.provider`, errors);
  ensureString(source.version, `${path}.version`, errors);
  ensureEnum(source.mode, allowedModes, `${path}.mode`, errors);
  if (source.deterministic !== true) {
    errors.push(`${path}.deterministic must be true.`);
  }
  ensureString(source.parityStatus, `${path}.parityStatus`, errors);
  ensureString(source.specAlignment, `${path}.specAlignment`, errors);
  ensureIsoDate(source.generatedAt, `${path}.generatedAt`, errors);
  return true;
}

export function validateEvaluateResponse(value: unknown): EvaluateResponse {
  const errors: string[] = [];
  if (!isObject(value)) {
    throw new ValidationError('INVALID_RESPONSE_BODY', ['Response must be an object.']);
  }

  ensureString(value.requestId, 'requestId', errors);

  if (!isObject(value.player)) {
    errors.push('player must be an object.');
  } else {
    ensureString(value.player.playerId, 'player.playerId', errors);
    ensureString(value.player.playerName, 'player.playerName', errors);
    ensureString(value.player.team, 'player.team', errors);
    ensureString(value.player.opponent, 'player.opponent', errors);
    ensureEnum(value.player.position, allowedPositions, 'player.position', errors);
    if (value.player.salary !== undefined) {
      ensureNumber(value.player.salary, 'player.salary', errors, { min: 1, integer: true });
    }
  }

  if (!isObject(value.score)) {
    errors.push('score must be an object.');
  } else {
    ensureNumber(value.score.overall, 'score.overall', errors, { min: 0, max: 100 });
    ensureEnum(value.score.tier, allowedTiers, 'score.tier', errors);
    ensureNumber(value.score.rankHint, 'score.rankHint', errors, { min: 1, integer: true });

    if (!Array.isArray(value.score.components) || value.score.components.length !== 4) {
      errors.push('score.components must contain exactly 4 entries.');
    } else {
      value.score.components.forEach((component, index) => validateScoreComponent(component, `score.components[${index}]`, errors));
    }
  }

  if (!isObject(value.confidence)) {
    errors.push('confidence must be an object.');
  } else {
    ensureNumber(value.confidence.score, 'confidence.score', errors, { min: 0, max: 1 });
    ensureEnum(value.confidence.label, allowedConfidenceLabels, 'confidence.label', errors);
    if (value.confidence.deterministic !== true) {
      errors.push('confidence.deterministic must be true.');
    }
    ensureString(value.confidence.reason, 'confidence.reason', errors);
  }

  if (!Array.isArray(value.reasons) || value.reasons.length === 0) {
    errors.push('reasons must be a non-empty array.');
  }

  validateMetadata(value.metadata, 'metadata', errors);
  validateSourceMetadata(value.source, 'source', errors);

  if (!Array.isArray(value.warnings)) {
    errors.push('warnings must be an array.');
  }

  if (errors.length > 0) {
    throw new ValidationError('INVALID_RESPONSE_BODY', errors);
  }

  return value as unknown as EvaluateResponse;
}

function validateRankedEvaluation(item: unknown, path: string, errors: string[], includeExplanations: boolean): void {
  if (!isObject(item)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  ensureNumber(item.rank, `${path}.rank`, errors, { min: 1, integer: true });
  ensureString(item.requestId, `${path}.requestId`, errors);

  if (!isObject(item.player)) {
    errors.push(`${path}.player must be an object.`);
  } else {
    ensureString(item.player.playerId, `${path}.player.playerId`, errors);
    ensureString(item.player.playerName, `${path}.player.playerName`, errors);
    ensureString(item.player.team, `${path}.player.team`, errors);
    ensureString(item.player.opponent, `${path}.player.opponent`, errors);
    ensureEnum(item.player.position, allowedPositions, `${path}.player.position`, errors);
  }

  if (!isObject(item.score)) {
    errors.push(`${path}.score must be an object.`);
  } else {
    ensureNumber(item.score.overall, `${path}.score.overall`, errors, { min: 0, max: 100 });
    ensureEnum(item.score.tier, allowedTiers, `${path}.score.tier`, errors);
    ensureNumber(item.score.rankHint, `${path}.score.rankHint`, errors, { min: 1, integer: true });
    if (!Array.isArray(item.score.components)) {
      errors.push(`${path}.score.components must be an array.`);
    } else if (includeExplanations) {
      if (item.score.components.length !== 4) {
        errors.push(`${path}.score.components must contain exactly 4 entries when includeExplanations=true.`);
      }
      item.score.components.forEach((component, index) => validateScoreComponent(component, `${path}.score.components[${index}]`, errors));
    } else if (item.score.components.length !== 0) {
      errors.push(`${path}.score.components must be empty when includeExplanations=false.`);
    }
  }

  if (!isObject(item.confidence)) {
    errors.push(`${path}.confidence must be an object.`);
  } else {
    ensureNumber(item.confidence.score, `${path}.confidence.score`, errors, { min: 0, max: 1 });
    ensureEnum(item.confidence.label, allowedConfidenceLabels, `${path}.confidence.label`, errors);
    if (item.confidence.deterministic !== true) {
      errors.push(`${path}.confidence.deterministic must be true.`);
    }
    ensureString(item.confidence.reason, `${path}.confidence.reason`, errors);
  }

  if (!Array.isArray(item.reasons) || item.reasons.length === 0) {
    errors.push(`${path}.reasons must be a non-empty array.`);
  }

  validateMetadata(item.metadata, `${path}.metadata`, errors);
  validateSourceMetadata(item.source, `${path}.source`, errors);

  if (!Array.isArray(item.warnings)) {
    errors.push(`${path}.warnings must be an array.`);
  }
}

export function validateRankingsResponse(value: unknown): RankingsResponse {
  const errors: string[] = [];
  if (!isObject(value)) {
    throw new ValidationError('INVALID_RESPONSE_BODY', ['Response must be an object.']);
  }

  ensureString(value.requestId, 'requestId', errors);
  ensureNumber(value.count, 'count', errors, { min: 0, integer: true });

  const includeExplanations = isObject(value.metadata) && typeof value.metadata.includeExplanations === 'boolean' ? value.metadata.includeExplanations : true;

  if (!isObject(value.metadata)) {
    errors.push('metadata must be an object.');
  } else {
    ensureNumber(value.metadata.totalCandidates, 'metadata.totalCandidates', errors, { min: 0, integer: true });
    ensureNumber(value.metadata.returnedCount, 'metadata.returnedCount', errors, { min: 0, integer: true });
    if (value.metadata.limitApplied !== null && value.metadata.limitApplied !== undefined) {
      ensureNumber(value.metadata.limitApplied, 'metadata.limitApplied', errors, { min: 1, integer: true });
    }
    ensureBoolean(value.metadata.includeExplanations, 'metadata.includeExplanations', errors);
  }

  validateSourceMetadata(value.source, 'source', errors);

  if (!Array.isArray(value.rankings)) {
    errors.push('rankings must be an array.');
  } else {
    value.rankings.forEach((item, index) => validateRankedEvaluation(item, `rankings[${index}]`, errors, includeExplanations));
  }

  if (!Array.isArray(value.warnings)) {
    errors.push('warnings must be an array.');
  }

  if (errors.length > 0) {
    throw new ValidationError('INVALID_RESPONSE_BODY', errors);
  }

  return value as unknown as RankingsResponse;
}

export function validateErrorEnvelope(value: unknown): ErrorEnvelope {
  const errors: string[] = [];
  if (!isObject(value) || !isObject(value.error)) {
    throw new ValidationError('INVALID_ERROR_ENVELOPE', ['error envelope must contain an error object.']);
  }

  ensureEnum(value.error.category, allowedErrorCategories, 'error.category', errors);
  ensureString(value.error.code, 'error.code', errors);
  ensureString(value.error.message, 'error.message', errors);
  ensureString(value.error.traceId, 'error.traceId', errors);

  if (errors.length > 0) {
    throw new ValidationError('INVALID_ERROR_ENVELOPE', errors);
  }

  return value as unknown as ErrorEnvelope;
}
