const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateFootballPlayer, rankFootballPlayers } = require('../dist/src/services/footballForgeService.js');
const { forgeFootballEvaluateFixture, forgeFootballInputs, footballFixtureContext } = require('../dist/tests/fixtures/forgeFootballFixtures.js');

test('football evaluate fixture is deterministic and FORGE-shaped', () => {
  const first = evaluateFootballPlayer(forgeFootballEvaluateFixture);
  const second = evaluateFootballPlayer(forgeFootballEvaluateFixture);

  assert.deepEqual(second, first);
  assert.equal(first.player.playerId, 'wr-featured-1');
  assert.equal(first.score.components.length, 4);
  assert.equal(first.source.provider, 'tiber-forge-football-lane');
});

test('football fixture ordering rewards opportunity and penalizes fragile low-coverage profile', () => {
  const rankings = rankFootballPlayers({
    requestId: 'football-fixture-pack',
    inputs: forgeFootballInputs,
    context: footballFixtureContext,
    includeExplanations: true
  });

  assert.deepEqual(rankings.rankings.map((entry) => entry.player.playerId), ['wr-featured-1', 'rb-volume-1', 'qb-dual-1', 'fragile-wr-1']);

  const byId = Object.fromEntries(rankings.rankings.map((entry) => [entry.player.playerId, entry]));
  assert.ok(byId['wr-featured-1'].score.overall > byId['fragile-wr-1'].score.overall);
  assert.ok(byId['qb-dual-1'].score.overall > byId['fragile-wr-1'].score.overall);
  assert.ok(byId['rb-volume-1'].score.components.find((component) => component.key === 'opportunity').score > byId['rb-volume-1'].score.components.find((component) => component.key === 'efficiency').score);
  assert.ok(byId['rb-volume-1'].score.overall > byId['fragile-wr-1'].score.overall);
  assert.equal(byId['fragile-wr-1'].confidence.label, 'low');
  assert.equal(byId['fragile-wr-1'].score.tier, 'avoid');
  assert.equal(byId['wr-featured-1'].source.inputContract, 'ForgeWeeklyPlayerInput/v1');
  assert.equal(byId['qb-dual-1'].player.opponent, 'UNK');
});
