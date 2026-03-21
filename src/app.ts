import { IncomingMessage, ServerResponse } from 'node:http';
import { AppConfig } from './config/env';
import { ErrorCategory } from './contracts/forge';
import { ValidationError, validateEvaluateRequest, validateRankingsRequest } from './contracts/validation';
import { openApiDocument } from './openapi/document';
import { evaluatePlayer, rankPlayers } from './services/forgeService';

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

function errorEnvelope(statusCode: number, category: ErrorCategory, code: string, message: string, details?: unknown): JsonResponse {
  return json(statusCode, {
    error: {
      category,
      code,
      message,
      details,
      traceId: `trace-${Date.now()}`
    }
  });
}

export async function handleRequest(request: IncomingMessage, state: AppState): Promise<JsonResponse> {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (method === 'GET' && url.pathname === '/') {
    return json(200, {
      service: 'tiber-forge',
      mode: state.config.FORGE_SERVICE_MODE,
      version: '0.1.0',
      description: 'Bootstrap standalone FORGE service for future adapter-backed TIBER-Fantasy integration.'
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
