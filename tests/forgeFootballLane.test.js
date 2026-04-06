const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateFootballPlayer, rankFootballPlayers } = require('../dist/src/services/footballForgeService.js');
const { forgeFootballEvaluateFixture, forgeFootballInputs, footballFixtureContext } = require('../dist/tests/fixtures/forgeFootballFixtures.js');

function environmentScore(response) {
  return response.score.components.find((component) => component.key === 'environment').score;
}

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

test('environment remains bounded and deterministic for weekly fixture cohort', () => {
  const first = rankFootballPlayers({
    requestId: 'environment-bounds-1',
    inputs: forgeFootballInputs,
    context: footballFixtureContext,
    includeExplanations: true
  });
  const second = rankFootballPlayers({
    requestId: 'environment-bounds-1',
    inputs: forgeFootballInputs,
    context: footballFixtureContext,
    includeExplanations: true
  });

  assert.deepEqual(second, first);
  assert.ok(first.rankings.every((entry) => Number.isFinite(environmentScore(entry))));
  assert.ok(first.rankings.every((entry) => environmentScore(entry) >= 0 && environmentScore(entry) <= 100));
});

test('environment differentiates opponent-defense tiers a bit more clearly', () => {
  const weakDefense = evaluateFootballPlayer({
    ...forgeFootballEvaluateFixture,
    requestId: 'environment-weak-defense',
    input: {
      ...forgeFootballEvaluateFixture.input,
      opponentDefenseTier: 'weak',
      impliedTeamTotal: 24,
      spread: -3,
      expectedGameScript: 'neutral'
    }
  });

  const eliteDefense = evaluateFootballPlayer({
    ...forgeFootballEvaluateFixture,
    requestId: 'environment-elite-defense',
    input: {
      ...forgeFootballEvaluateFixture.input,
      opponentDefenseTier: 'elite',
      impliedTeamTotal: 24,
      spread: -3,
      expectedGameScript: 'neutral'
    }
  });

  assert.ok(environmentScore(weakDefense) - environmentScore(eliteDefense) >= 20);
});

test('environment script handling creates clearer but still reasonable positional differences', () => {
  const wrNegativeScript = evaluateFootballPlayer({
    ...forgeFootballEvaluateFixture,
    requestId: 'environment-wr-negative-script',
    input: {
      ...forgeFootballEvaluateFixture.input,
      position: 'WR',
      expectedGameScript: 'negative',
      spread: 6,
      impliedTeamTotal: 23,
      opponentDefenseTier: 'neutral'
    }
  });

  const rbNegativeScript = evaluateFootballPlayer({
    ...forgeFootballEvaluateFixture,
    requestId: 'environment-rb-negative-script',
    input: {
      ...forgeFootballEvaluateFixture.input,
      position: 'RB',
      expectedGameScript: 'negative',
      spread: 6,
      impliedTeamTotal: 23,
      opponentDefenseTier: 'neutral'
    }
  });

  assert.ok(environmentScore(wrNegativeScript) > environmentScore(rbNegativeScript));
  assert.ok(environmentScore(wrNegativeScript) - environmentScore(rbNegativeScript) >= 6);
});

test('implied team total still matters while context can still shift environment scores', () => {
  const highTotalNeutral = evaluateFootballPlayer({
    ...forgeFootballEvaluateFixture,
    requestId: 'environment-high-total-neutral',
    input: {
      ...forgeFootballEvaluateFixture.input,
      position: 'RB',
      impliedTeamTotal: 30,
      opponentDefenseTier: 'neutral',
      expectedGameScript: 'neutral',
      spread: 0
    }
  });

  const lowTotalNeutral = evaluateFootballPlayer({
    ...forgeFootballEvaluateFixture,
    requestId: 'environment-low-total-neutral',
    input: {
      ...forgeFootballEvaluateFixture.input,
      position: 'RB',
      impliedTeamTotal: 18,
      opponentDefenseTier: 'neutral',
      expectedGameScript: 'neutral',
      spread: 0
    }
  });

  const highTotalBrutalContext = evaluateFootballPlayer({
    ...forgeFootballEvaluateFixture,
    requestId: 'environment-high-total-brutal',
    input: {
      ...forgeFootballEvaluateFixture.input,
      position: 'RB',
      impliedTeamTotal: 30,
      opponentDefenseTier: 'elite',
      expectedGameScript: 'negative',
      spread: 6
    }
  });

  const lowTotalFavorableContext = evaluateFootballPlayer({
    ...forgeFootballEvaluateFixture,
    requestId: 'environment-low-total-favorable',
    input: {
      ...forgeFootballEvaluateFixture.input,
      position: 'RB',
      impliedTeamTotal: 18,
      opponentDefenseTier: 'weak',
      expectedGameScript: 'positive',
      spread: -6
    }
  });

  assert.ok(environmentScore(highTotalNeutral) > environmentScore(lowTotalNeutral));
  assert.ok(environmentScore(highTotalNeutral) - environmentScore(lowTotalNeutral) >= 20);
  assert.ok(environmentScore(lowTotalFavorableContext) > environmentScore(highTotalBrutalContext));
});
