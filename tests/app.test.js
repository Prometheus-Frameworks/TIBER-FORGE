const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const path = require('node:path');
const { loadConfig } = require('../dist/src/config/env.js');
const { createRequestListener } = require('../dist/src/app.js');
const { forgeParityPlayers } = require('../dist/tests/fixtures/forgeParityFixtures.js');
const { forgeFootballEvaluateFixture, forgeFootballInputs, footballFixtureContext } = require('../dist/tests/fixtures/forgeFootballFixtures.js');

const validEvaluateRequest = {
  requestId: 'req-eval-1',
  player: {
    playerId: 'player-1',
    playerName: 'Demo Guard',
    team: 'AAA',
    opponent: 'BBB',
    position: 'PG',
    salary: 8200,
    projectedMinutes: 34,
    recentFantasyPoints: 42,
    injuryStatus: 'healthy',
    tags: ['starter']
  },
  context: {
    slateId: 'slate-2026-03-21-main',
    slateDate: '2026-03-21T19:00:00Z',
    sport: 'nba',
    site: 'draftkings',
    contestType: 'tournament',
    mode: 'bootstrap-demo'
  }
};

const parityFixturePlayers = forgeParityPlayers;


async function withServer(fn) {
  process.env.FORGE_SERVICE_MODE = 'bootstrap-demo';
  process.env.FORGE_WEEKLY_INPUT_ARTIFACT_PATH = path.resolve(process.cwd(), 'tests/fixtures/artifacts/forge_weekly_player_input_2025_w12.upstream_compat.mirror.json');
  delete process.env.PORT;
  const config = loadConfig(process.env);
  const server = createServer(createRequestListener(config));

  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test('GET /health returns ok status', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
  });
});

test('GET /ready returns ready status', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/ready`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ready');
    assert.equal(body.mode, 'bootstrap-demo');
  });
});

test('POST /api/forge/evaluate returns transition-aligned deterministic response shape', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/forge/evaluate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validEvaluateRequest)
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.requestId, 'req-eval-1');
    assert.equal(body.player.playerId, 'player-1');
    assert.equal(body.score.overall, 90.52);
    assert.equal(body.score.tier, 'core');
    assert.equal(body.score.rankHint, 10);
    assert.equal(body.score.components.length, 4);
    assert.deepEqual(body.score.components.map((component) => component.key), ['opportunity', 'recent_form', 'salary_efficiency', 'availability']);
    assert.equal(body.confidence.score, 0.99);
    assert.equal(body.confidence.deterministic, true);
    assert.equal(body.metadata.bootstrap, true);
    assert.equal(body.source.mode, 'bootstrap-demo');
    assert.equal(body.source.specAlignment, 'pr72-transition');
    assert.match(body.confidence.reason, /scaffold logic rather than full legacy parity/);
    assert.match(body.warnings[0], /legacy FORGE parity remains intentionally deferred/);
  });
});

test('POST /api/forge/evaluate is deterministic for identical requests', async () => {
  await withServer(async (baseUrl) => {
    const requestBody = JSON.stringify(validEvaluateRequest);
    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${baseUrl}/api/forge/evaluate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: requestBody
      }),
      fetch(`${baseUrl}/api/forge/evaluate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: requestBody
      })
    ]);

    const firstBody = await firstResponse.json();
    const secondBody = await secondResponse.json();

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 200);
    assert.deepEqual(firstBody, secondBody);
  });
});

test('POST /api/forge/evaluate rejects invalid request bodies with stable envelopes', async () => {
  await withServer(async (baseUrl) => {
    const invalidPayload = {
      ...validEvaluateRequest,
      player: {
        ...validEvaluateRequest.player,
        playerId: ''
      }
    };

    const response = await fetch(`${baseUrl}/api/forge/evaluate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(invalidPayload)
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.category, 'VALIDATION_ERROR');
    assert.equal(body.error.code, 'INVALID_REQUEST_BODY');
    assert.equal(body.error.traceId, 'trace-validation_error-invalid_request_body');
  });
});

test('POST /api/forge/rankings returns aligned ranked outputs for parity-style core scenarios', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/forge/rankings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: 'req-rank-1',
        players: parityFixturePlayers,
        context: validEvaluateRequest.context,
        limit: 6,
        includeExplanations: true
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.count, 6);
    assert.equal(body.metadata.totalCandidates, 6);
    assert.equal(body.metadata.returnedCount, 6);
    assert.equal(body.metadata.limitApplied, 6);
    assert.equal(body.metadata.includeExplanations, true);
    assert.deepEqual(
      body.rankings.map((entry) => entry.player.playerId),
      ['elite-1', 'steady-1', 'mid-1', 'volatile-1', 'weak-1', 'lowavail-1']
    );
    assert.equal(body.rankings[0].rank, 1);
    assert.equal(body.rankings[0].score.tier, 'core');
    assert.equal(body.rankings[1].score.tier, 'core');
    assert.equal(body.rankings[5].score.tier, 'neutral');
    assert.equal(body.rankings[0].score.components.length, 4);
  });
});

test('POST /api/forge/rankings penalizes weak opportunity and low availability scenarios', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/forge/rankings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: 'req-rank-penalties',
        players: parityFixturePlayers,
        context: validEvaluateRequest.context,
        includeExplanations: true
      })
    });
    const body = await response.json();
    const byId = Object.fromEntries(body.rankings.map((entry) => [entry.player.playerId, entry]));

    assert.equal(response.status, 200);
    assert.ok(byId['weak-1'].score.overall < byId['mid-1'].score.overall);
    assert.ok(byId['weak-1'].score.components.find((component) => component.key === 'opportunity').score < 50);
    assert.match(byId['weak-1'].score.components.find((component) => component.key === 'opportunity').reason, /weak-opportunity range/);
    assert.ok(byId['lowavail-1'].score.overall < byId['weak-1'].score.overall);
    assert.ok(byId['lowavail-1'].score.components.find((component) => component.key === 'availability').score < 30);
    assert.equal(byId['lowavail-1'].confidence.label, 'low');
    assert.equal(byId['elite-1'].confidence.label, 'high');
  });
});

test('POST /api/forge/rankings supports includeExplanations=false deterministically', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/forge/rankings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: 'req-rank-compact',
        players: [validEvaluateRequest.player],
        context: validEvaluateRequest.context,
        limit: 1,
        includeExplanations: false
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.metadata.includeExplanations, false);
    assert.equal(body.rankings[0].score.components.length, 0);
    assert.deepEqual(body.rankings[0].reasons, ['Explanation output suppressed by includeExplanations=false during bootstrap mode.']);
  });
});



test('POST /api/forge/evaluate-football returns FORGE-shaped deterministic football-lane response', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/forge/evaluate-football`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(forgeFootballEvaluateFixture)
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.requestId, 'football-eval-featured');
    assert.equal(body.player.playerId, 'wr-featured-1');
    assert.deepEqual(body.score.components.map((component) => component.key), ['opportunity', 'efficiency', 'environment', 'stability']);
    assert.equal(body.source.provider, 'tiber-forge-football-lane');
    assert.equal(body.source.inputContract, 'ForgeWeeklyPlayerInput/v1');
    assert.equal(body.source.parityStatus, 'football-lane-v1');
    assert.equal(body.metadata.bootstrap, false);
    assert.equal(body.metadata.inputContract, 'ForgeWeeklyPlayerInput/v1');
  });
});

test('POST /api/forge/rankings-football stays deterministic with stable ordering for fixture pack', async () => {
  await withServer(async (baseUrl) => {
    const payload = JSON.stringify({
      requestId: 'football-rankings-1',
      inputs: forgeFootballInputs,
      context: footballFixtureContext,
      includeExplanations: true
    });

    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${baseUrl}/api/forge/rankings-football`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload
      }),
      fetch(`${baseUrl}/api/forge/rankings-football`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload
      })
    ]);

    const firstBody = await firstResponse.json();
    const secondBody = await secondResponse.json();

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 200);
    assert.deepEqual(secondBody, firstBody);
    assert.deepEqual(firstBody.rankings.map((entry) => entry.player.playerId), ['wr-featured-1', 'qb-dual-1', 'fragile-wr-1']);
    assert.equal(firstBody.rankings[1].player.opponent, 'UNK');
    assert.equal(firstBody.rankings[0].confidence.label, 'high');
    assert.equal(firstBody.rankings[2].confidence.label, 'low');
  });
});

test('POST /api/forge/evaluate-football enforces upstream-compatible numeric hint shape', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/forge/evaluate-football`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...forgeFootballEvaluateFixture,
        input: {
          ...forgeFootballEvaluateFixture.input,
          dataConfidenceHint: 'high-confidence upstream feed'
        }
      })
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.category, 'VALIDATION_ERROR');
  });
});



test('POST /api/forge/rankings-football/from-artifact returns deterministic FORGE-shaped rankings from canonical sample artifact', async () => {
  await withServer(async (baseUrl) => {
    const payload = JSON.stringify({
      requestId: 'football-artifact-rankings-1',
      includeExplanations: true
    });

    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${baseUrl}/api/forge/rankings-football/from-artifact`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload
      }),
      fetch(`${baseUrl}/api/forge/rankings-football/from-artifact`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload
      })
    ]);

    const firstBody = await firstResponse.json();
    const secondBody = await secondResponse.json();

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 200);
    assert.deepEqual(firstBody, secondBody);
    assert.deepEqual(firstBody.rankings.map((entry) => entry.player.playerId), ['wr-featured-1', 'qb-dual-1', 'fragile-wr-1']);
    assert.equal(firstBody.source.provider, 'tiber-forge-football-lane');
    assert.ok(firstBody.warnings.some((warning) => warning.includes('Artifact ingestion path')));
    assert.ok(firstBody.warnings.some((warning) => warning.includes('not live TIBER-Data pull parity')));
  });
});

test('POST /api/forge/rankings-football/from-artifact fails closed for invalid artifact override', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/forge/rankings-football/from-artifact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ artifactPath: 'tests/fixtures/forgeFootballFixtures.ts' })
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.category, 'VALIDATION_ERROR');
    assert.equal(body.error.code, 'ARTIFACT_INVALID_JSON');
  });
});

test('POST /api/forge/rankings rejects malformed requests', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/forge/rankings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ players: [], context: validEvaluateRequest.context })
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.category, 'VALIDATION_ERROR');
    assert.equal(body.error.traceId, 'trace-validation_error-invalid_request_body');
  });
});

test('unknown routes return stable error envelopes', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/missing-route`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error.category, 'NOT_FOUND');
    assert.equal(body.error.code, 'ROUTE_NOT_FOUND');
    assert.equal(body.error.traceId, 'trace-not_found-route_not_found');
  });
});

test('loadConfig fails fast when required config is missing', () => {
  delete process.env.FORGE_SERVICE_MODE;
  assert.throws(() => loadConfig(process.env), /FORGE_SERVICE_MODE/);
});
