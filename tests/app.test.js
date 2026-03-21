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

const parityFixturePlayers = [
  {
    playerId: 'elite-1',
    playerName: 'Elite Alpha',
    team: 'AAA',
    opponent: 'BBB',
    position: 'PG',
    salary: 9300,
    projectedMinutes: 37,
    recentFantasyPoints: 48,
    injuryStatus: 'healthy',
    tags: ['starter', 'ceiling']
  },
  {
    playerId: 'mid-1',
    playerName: 'Mid Stable',
    team: 'CCC',
    opponent: 'DDD',
    position: 'SF',
    salary: 7000,
    projectedMinutes: 32,
    recentFantasyPoints: 33,
    injuryStatus: 'healthy',
    tags: ['starter']
  },
  {
    playerId: 'volatile-1',
    playerName: 'Volatile Flash',
    team: 'EEE',
    opponent: 'FFF',
    position: 'SG',
    salary: 7600,
    projectedMinutes: 24,
    recentFantasyPoints: 37,
    injuryStatus: 'questionable',
    tags: ['boom-bust']
  },
  {
    playerId: 'weak-1',
    playerName: 'Weak Opportunity',
    team: 'GGG',
    opponent: 'HHH',
    position: 'PF',
    salary: 5800,
    projectedMinutes: 16,
    recentFantasyPoints: 18,
    injuryStatus: 'healthy',
    tags: []
  },
  {
    playerId: 'lowavail-1',
    playerName: 'Low Availability',
    team: 'III',
    opponent: 'JJJ',
    position: 'C',
    salary: 6800,
    projectedMinutes: 28,
    recentFantasyPoints: 31,
    injuryStatus: 'doubtful',
    tags: ['starter']
  }
];

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
        limit: 5,
        includeExplanations: true
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.count, 5);
    assert.equal(body.metadata.totalCandidates, 5);
    assert.equal(body.metadata.returnedCount, 5);
    assert.equal(body.metadata.limitApplied, 5);
    assert.equal(body.metadata.includeExplanations, true);
    assert.deepEqual(
      body.rankings.map((entry) => entry.player.playerId),
      ['elite-1', 'mid-1', 'volatile-1', 'weak-1', 'lowavail-1']
    );
    assert.equal(body.rankings[0].rank, 1);
    assert.equal(body.rankings[0].score.tier, 'core');
    assert.equal(body.rankings[1].score.tier, 'core');
    assert.equal(body.rankings[4].score.tier, 'neutral');
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
