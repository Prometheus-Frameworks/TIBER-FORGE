import { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { AppConfig } from './config/env';
import { ErrorCategory } from './contracts/forge';
import { ValidationError, validateEvaluateRequest, validateFootballArtifactRankingsRequest, validateFootballEvaluateRequest, validateFootballRankingsRequest, validateRankingsRequest } from './contracts/validation';
import { openApiDocument } from './openapi/document';
import { evaluatePlayer, rankPlayers } from './services/forgeService';
import { evaluateFootballPlayer, rankFootballPlayers } from './services/footballForgeService';
import { ingestForgeWeeklyArtifact } from './ingestion/forgeWeeklyArtifact';
import { ingestForgeSeasonArtifact } from './ingestion/forgeSeasonArtifact';
import { ForgeSeasonGradeTier, ForgeSeasonPlayerGrade, ForgeSeasonPosition } from './contracts/football';
import { rankSeasonPlayers } from './services/seasonForgeService';

const SERVICE_VERSION = '0.2.0';

const REAL_PLAYER_SEASON_FIXTURE_PATH = 'tests/fixtures/artifacts/forge_season_player_input_2025.real_players_sample.json';
const FIXTURE_INSPECTOR_WARNING = 'Fixture-backed calibration data only. Not live TIBER-Data. Retrospective grades only.';
const FIXTURE_INSPECTOR_CONTEXT = 'These are recognizable calibration profiles for local FORGE inspection, not source-truth rows or verified 2025 stats.';
const FILTERABLE_POSITIONS: ForgeSeasonPosition[] = ['QB', 'RB', 'WR', 'TE'];
const FILTERABLE_TIERS: ForgeSeasonGradeTier[] = ['elite', 'high', 'solid', 'volatile', 'low'];
const COMPONENT_KEYS = ['realized_ppr', 'volume', 'efficiency', 'availability', 'fragility'] as const;

type FixtureGradeRow = ForgeSeasonPlayerGrade & {
  sourceSetId: string;
  qualityFlags: string[];
};

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function routeWarnings(warnings: string[]): string[] {
  return warnings.filter((warning) => !/projection/i.test(warning));
}

async function realPlayerFixtureRankings(filters: { position?: string | null; tier?: string | null }) {
  const artifactPath = resolve(process.cwd(), REAL_PLAYER_SEASON_FIXTURE_PATH);
  const inputs = await ingestForgeSeasonArtifact(artifactPath);
  const qualityFlagsByPlayerId = new Map(inputs.map((input) => [input.playerId, input.qualityFlags ?? []]));
  const result = rankSeasonPlayers(inputs);

  const position = FILTERABLE_POSITIONS.includes(filters.position as ForgeSeasonPosition) ? (filters.position as ForgeSeasonPosition) : undefined;
  const tier = FILTERABLE_TIERS.includes(filters.tier as ForgeSeasonGradeTier) ? (filters.tier as ForgeSeasonGradeTier) : undefined;

  const rankings: FixtureGradeRow[] = result.rankings
    .filter((entry) => (position ? entry.player.position === position : true))
    .filter((entry) => (tier ? entry.tier === tier : true))
    .map((entry) => ({
      ...entry,
      sourceSetId: result.sourceSetId,
      qualityFlags: qualityFlagsByPlayerId.get(entry.player.playerId) ?? [],
      warnings: routeWarnings(entry.warnings)
    }));

  return {
    season: result.season,
    sourceSetId: result.sourceSetId,
    fixturePath: REAL_PLAYER_SEASON_FIXTURE_PATH,
    warning: FIXTURE_INSPECTOR_WARNING,
    context: FIXTURE_INSPECTOR_CONTEXT,
    filters: { position: position ?? null, tier: tier ?? null },
    count: rankings.length,
    totalFixtureCandidates: result.count,
    rankings,
    warnings: [FIXTURE_INSPECTOR_WARNING, FIXTURE_INSPECTOR_CONTEXT, ...routeWarnings(result.warnings)]
  };
}

function renderFixtureInspectorPage(data: Awaited<ReturnType<typeof realPlayerFixtureRankings>>): string {
  const filterOption = (value: string, selected: string | null) => `<option value="${escapeHtml(value)}"${selected === value ? ' selected' : ''}>${escapeHtml(value)}</option>`;
  const rows = data.rankings
    .map((entry) => {
      const componentCells = COMPONENT_KEYS.map((key) => {
        const component = entry.components.find((item) => item.key === key);
        return `<td>${component ? escapeHtml(component.score) : 'n/a'}</td>`;
      }).join('');
      const warningItems = entry.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('');
      const flagItems = entry.qualityFlags.map((flag) => `<span class="flag">${escapeHtml(flag)}</span>`).join(' ');
      return `<tr>
        <td>${escapeHtml(entry.rank)}</td>
        <td><strong>${escapeHtml(entry.player.playerName)}</strong><br><small>${escapeHtml(entry.player.playerId)}</small></td>
        <td>${escapeHtml(entry.player.position)} / ${escapeHtml(entry.player.team)}</td>
        <td>${escapeHtml(entry.score)}</td>
        <td>${escapeHtml(entry.tier)}</td>
        <td>${escapeHtml(entry.confidence.label)} (${escapeHtml(entry.confidence.score)})</td>
        ${componentCells}
        <td>${flagItems || '<span class="muted">none</span>'}<ul>${warningItems}</ul></td>
        <td>${escapeHtml(entry.sourceSetId)}</td>
      </tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>FORGE Season Grade Inspector</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; background: #f7f7f4; color: #1f2933; }
    .banner { border: 2px solid #a15c00; background: #fff4d6; padding: 12px; font-weight: 700; margin: 16px 0; }
    .note { max-width: 900px; color: #43515f; }
    form { display: flex; gap: 12px; align-items: end; margin: 18px 0; }
    label { display: grid; gap: 4px; font-weight: 600; }
    table { border-collapse: collapse; width: 100%; background: white; }
    th, td { border: 1px solid #d7dce0; padding: 8px; vertical-align: top; text-align: left; }
    th { background: #e9edf1; position: sticky; top: 0; }
    small, .muted { color: #687887; }
    .flag { display: inline-block; margin: 0 4px 4px 0; padding: 2px 6px; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 4px; font-size: 12px; }
    ul { margin: 6px 0 0 18px; padding: 0; }
  </style>
</head>
<body>
  <h1>FORGE Season Grade Inspector</h1>
  <div class="banner">${escapeHtml(data.warning)}</div>
  <p class="note">${escapeHtml(data.context)}</p>
  <p><strong>sourceSetId:</strong> ${escapeHtml(data.sourceSetId)} | <strong>Fixture:</strong> ${escapeHtml(data.fixturePath)} | <strong>Showing:</strong> ${escapeHtml(data.count)} of ${escapeHtml(data.totalFixtureCandidates)}</p>
  <form method="get" action="/season/2025/fixture-inspector">
    <label>Position
      <select name="position">
        <option value="">All</option>${FILTERABLE_POSITIONS.map((position) => filterOption(position, data.filters.position)).join('')}
      </select>
    </label>
    <label>Tier
      <select name="tier">
        <option value="">All</option>${FILTERABLE_TIERS.map((tier) => filterOption(tier, data.filters.tier)).join('')}
      </select>
    </label>
    <button type="submit">Apply filters</button>
    <a href="/season/2025/fixture-inspector">Reset</a>
  </form>
  <table>
    <thead><tr><th>Rank</th><th>Player</th><th>Position/Team</th><th>Score</th><th>Tier</th><th>Confidence</th><th>realized_ppr</th><th>volume</th><th>efficiency</th><th>availability</th><th>fragility</th><th>Warnings / quality flags</th><th>sourceSetId</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

interface AppState {
  readonly config: AppConfig;
  readonly ready: boolean;
  readonly checkedAt: string;
}

interface JsonResponse {
  statusCode: number;
  body: unknown;
  contentType?: string;
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

function html(statusCode: number, body: string): JsonResponse {
  return { statusCode, body, contentType: 'text/html; charset=utf-8' };
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
}): string {
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
      artifactWeek: artifactRequest.artifactWeek
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
        `Artifact lane: ${artifactKind}${artifactRequest.artifactWeek !== undefined ? ` (week ${artifactRequest.artifactWeek})` : ''}.`,
        `Artifact ingestion path: ${artifactPath}.`,
        'Artifact-driven rankings read disk artifacts and are not live TIBER-Data pull parity.'
      ]
    });
  }


  if (method === 'GET' && url.pathname === '/season/2025/fixture-rankings') {
    return json(200, await realPlayerFixtureRankings({ position: url.searchParams.get('position'), tier: url.searchParams.get('tier') }));
  }

  if (method === 'GET' && url.pathname === '/season/2025/fixture-inspector') {
    const data = await realPlayerFixtureRankings({ position: url.searchParams.get('position'), tier: url.searchParams.get('tier') });
    return html(200, renderFixtureInspectorPage(data));
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
      response.setHeader('content-type', result.contentType ?? 'application/json; charset=utf-8');
      response.end(result.contentType?.startsWith('text/html') ? String(result.body) : JSON.stringify(result.body));
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
