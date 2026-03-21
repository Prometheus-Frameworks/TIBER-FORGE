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

test('POST /api/forge/evaluate returns canonical deterministic response shape', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/forge/evaluate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validEvaluateRequest)
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.requestId, 'req-eval-1');
    assert.equal(body.playerId, 'player-1');
    assert.equal(body.score, 88.46);
    assert.equal(body.tier, 'core');
    assert.equal(body.components.length, 4);
    assert.equal(body.source.mode, 'bootstrap-demo');
    assert.match(body.warnings[0], /Bootstrap\/demo scoring only/);
  });
});

test('POST /api/forge/evaluate rejects invalid request bodies', async () => {
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
  });
});

test('POST /api/forge/rankings returns ranked outputs', async () => {
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
    assert.equal(body.rankings[0].rank, 1);
    assert.equal(body.rankings[0].evaluation.playerId, 'player-1');
    assert.equal(body.rankings[1].evaluation.playerId, 'player-2');
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
  });
});

test('unknown routes return stable error envelopes', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/missing-route`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error.category, 'NOT_FOUND');
    assert.equal(body.error.code, 'ROUTE_NOT_FOUND');
  });
});

test('loadConfig fails fast when required config is missing', () => {
  delete process.env.FORGE_SERVICE_MODE;
  assert.throws(() => loadConfig(process.env), /FORGE_SERVICE_MODE/);
});
