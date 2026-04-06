import { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { AppConfig } from './config/env';
import { ErrorCategory } from './contracts/forge';
import { ValidationError, validateEvaluateRequest, validateFootballArtifactRankingsRequest, validateFootballEvaluateRequest, validateFootballRankingsRequest, validateRankingsRequest } from './contracts/validation';
import { openApiDocument } from './openapi/document';
import { evaluatePlayer, rankPlayers } from './services/forgeService';
import { evaluateFootballPlayer, rankFootballPlayers } from './services/footballForgeService';
import { ingestForgeWeeklyArtifact } from './ingestion/forgeWeeklyArtifact';

const SERVICE_VERSION = '0.2.0';

interface AppState {
  readonly config: AppConfig;
  readonly ready: boolean;
  readonly checkedAt: string;
}

interface JsonResponse {
  statusCode: number;
  body: unknown;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError('INVALID_JSON', ['Body must be valid JSON.'], 'Malformed JSON request body.');
  }
}

function json(statusCode: number, body: unknown): JsonResponse {
  return { statusCode, body };
}

function traceId(category: ErrorCategory, code: string): string {
  return `trace-${category.toLowerCase()}-${code.toLowerCase()}`;
}

function errorEnvelope(statusCode: number, category: ErrorCategory, code: string, message: string, details?: unknown): JsonResponse {
  return json(statusCode, {
    error: {
      category,
      code,
      message,
      details,
      traceId: traceId(category, code)
    }
  });
}



function artifactPathForRequest(options: {
  samplePath: string;
  derivedQbPath: string;
  derivedSkillPath: string;
  derivedSkillPathTemplate?: string;
  artifactKind: 'sample' | 'derived_qb' | 'derived_skill';
  artifactWeek?: number;
  overridePath?: string;
}): string {
  if (options.overridePath) {
    return resolve(process.cwd(), options.overridePath);
  }

  if (options.artifactKind === 'derived_skill' && options.artifactWeek !== undefined && options.derivedSkillPathTemplate) {
    const week = String(options.artifactWeek).padStart(2, '0');
    const season = '2024';
    const fromTemplate = options.derivedSkillPathTemplate.replaceAll('{week}', week).replaceAll('{season}', season);
    return resolve(process.cwd(), fromTemplate);
  }

  const configuredPath =
    options.artifactKind === 'derived_qb'
      ? options.derivedQbPath
      : options.artifactKind === 'derived_skill'
        ? options.derivedSkillPath
        : options.samplePath;
  return resolve(process.cwd(), configuredPath);
}

function defaultArtifactContext(records: Array<{ season: number; week: number; asOf: string }>, artifactKind: 'sample' | 'derived_qb' | 'derived_skill') {
  const first = records[0];
  const site =
    artifactKind === 'derived_qb'
      ? 'artifact-derived-qb'
      : artifactKind === 'derived_skill'
        ? 'artifact-derived-skill'
        : 'artifact-sample';
  return {
    slateId: `nfl-${first.season}-w${first.week}-artifact`,
    slateDate: first.asOf,
    sport: 'nfl',
    site,
    contestType: 'simulation' as const,
    mode: 'bootstrap-demo' as const
  };
}
export async function handleRequest(request: IncomingMessage, state: AppState): Promise<JsonResponse> {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (method === 'GET' && url.pathname === '/') {
    return json(200, {
      service: 'tiber-forge',
      mode: state.config.FORGE_SERVICE_MODE,
      version: SERVICE_VERSION,
      description: 'Bootstrap standalone FORGE service aligned to the PR72 transition contract without claiming full parity.'
    });
  }

  if (method === 'GET' && url.pathname === '/health') {
    return json(200, { status: 'ok', timestamp: new Date().toISOString() });
  }

  if (method === 'GET' && url.pathname === '/ready') {
    return state.ready
      ? json(200, { status: 'ready', checkedAt: state.checkedAt, mode: state.config.FORGE_SERVICE_MODE })
      : errorEnvelope(503, 'NOT_READY', 'SERVICE_NOT_READY', 'Service is not ready.');
  }

  if (method === 'GET' && url.pathname === '/openapi.json') {
    return json(200, openApiDocument);
  }

  if (method === 'POST' && url.pathname === '/api/forge/evaluate') {
    const payload = await readJsonBody(request);
    return json(200, evaluatePlayer(validateEvaluateRequest(payload)));
  }

  if (method === 'POST' && url.pathname === '/api/forge/rankings') {
    const payload = await readJsonBody(request);
    return json(200, rankPlayers(validateRankingsRequest(payload)));
  }


  if (method === 'POST' && url.pathname === '/api/forge/evaluate-football') {
    const payload = await readJsonBody(request);
    return json(200, evaluateFootballPlayer(validateFootballEvaluateRequest(payload)));
  }

  if (method === 'POST' && url.pathname === '/api/forge/rankings-football') {
    const payload = await readJsonBody(request);
    return json(200, rankFootballPlayers(validateFootballRankingsRequest(payload)));
  }


  if (method === 'POST' && url.pathname === '/api/forge/rankings-football/from-artifact') {
    const payload = await readJsonBody(request);
    const artifactRequest = validateFootballArtifactRankingsRequest(payload);
    const artifactPath = artifactPathForRequest({
      samplePath: state.config.FORGE_WEEKLY_INPUT_ARTIFACT_PATH,
      derivedQbPath: state.config.FORGE_WEEKLY_DERIVED_QB_ARTIFACT_PATH,
      derivedSkillPath: state.config.FORGE_WEEKLY_DERIVED_SKILL_ARTIFACT_PATH,
      derivedSkillPathTemplate: state.config.FORGE_WEEKLY_DERIVED_SKILL_ARTIFACT_PATH_TEMPLATE,
      artifactKind: artifactRequest.artifactKind ?? 'sample',
      artifactWeek: artifactRequest.artifactWeek,
      overridePath: artifactRequest.artifactPath
    });
    const artifactKind = artifactRequest.artifactKind ?? 'sample';
    const inputs = await ingestForgeWeeklyArtifact(artifactPath);
    const context = artifactRequest.context ?? defaultArtifactContext(inputs, artifactKind);

    const rankings = rankFootballPlayers({
      requestId: artifactRequest.requestId,
      context,
      inputs,
      limit: artifactRequest.limit,
      includeExplanations: artifactRequest.includeExplanations
    });

    return json(200, {
      ...rankings,
      warnings: [
        ...rankings.warnings,
        `Artifact lane: ${artifactKind}${artifactRequest.artifactWeek !== undefined ? ` (week ${artifactRequest.artifactWeek})` : ''}${artifactRequest.artifactPath ? ' (explicit artifactPath override provided)' : ''}.`,
        `Artifact ingestion path: ${artifactPath}.`,
        'Artifact-driven rankings read disk artifacts and are not live TIBER-Data pull parity.'
      ]
    });
  }

  return errorEnvelope(404, 'NOT_FOUND', 'ROUTE_NOT_FOUND', 'Route not found.');
}

export function createRequestListener(config: AppConfig) {
  const state: AppState = {
    config,
    ready: true,
    checkedAt: new Date().toISOString()
  };

  return async (request: IncomingMessage, response: ServerResponse) => {
    try {
      const result = await handleRequest(request, state);
      response.statusCode = result.statusCode;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(JSON.stringify(result.body));
    } catch (error) {
      const failure =
        error instanceof ValidationError
          ? errorEnvelope(400, 'VALIDATION_ERROR', error.code, error.message, error.details)
          : errorEnvelope(500, 'INTERNAL_ERROR', 'UNEXPECTED_ERROR', 'Unexpected internal error.');

      response.statusCode = failure.statusCode;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(JSON.stringify(failure.body));
    }
  };
}
