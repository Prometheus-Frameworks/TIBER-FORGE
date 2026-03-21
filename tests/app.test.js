const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { loadConfig } = require('../dist/src/config/env.js');
const { createRequestListener } = require('../dist/src/app.js');

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

async function withServer(fn) {
  process.env.FORGE_SERVICE_MODE = 'bootstrap-demo';
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
    assert.equal(body.score.overall, 88.46);
    assert.equal(body.score.tier, 'core');
    assert.equal(body.score.rankHint, 13);
    assert.equal(body.score.components.length, 4);
    assert.deepEqual(body.score.components.map((component) => component.key), ['opportunity', 'recent_form', 'salary_efficiency', 'availability']);
    assert.equal(body.confidence.score, 0.98);
    assert.equal(body.confidence.deterministic, true);
    assert.equal(body.metadata.bootstrap, true);
    assert.equal(body.source.mode, 'bootstrap-demo');
    assert.equal(body.source.specAlignment, 'pr72-transition');
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

test('POST /api/forge/rankings returns aligned ranked outputs', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/forge/rankings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: 'req-rank-1',
        players: [
          validEvaluateRequest.player,
          {
            playerId: 'player-2',
            playerName: 'Value Wing',
            team: 'CCC',
            opponent: 'DDD',
            position: 'SF',
            salary: 6100,
            projectedMinutes: 30,
            recentFantasyPoints: 28,
            injuryStatus: 'questionable',
            tags: []
          }
        ],
        context: validEvaluateRequest.context,
        limit: 2,
        includeExplanations: true
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.count, 2);
    assert.equal(body.metadata.totalCandidates, 2);
    assert.equal(body.metadata.returnedCount, 2);
    assert.equal(body.metadata.limitApplied, 2);
    assert.equal(body.metadata.includeExplanations, true);
    assert.equal(body.rankings[0].rank, 1);
    assert.equal(body.rankings[0].player.playerId, 'player-1');
    assert.equal(body.rankings[1].player.playerId, 'player-2');
    assert.equal(body.rankings[0].score.components.length, 4);
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
