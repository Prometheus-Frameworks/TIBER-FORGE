const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluatePlayer, rankPlayers } = require('../dist/src/services/forgeService.js');
const { forgeParityFixtures, forgeParityPlayers, forgeParityContext } = require('../dist/tests/fixtures/forgeParityFixtures.js');

function evaluateFixture(fixture) {
  return evaluatePlayer(fixture.request);
}

function evaluateFixtures() {
  return Object.fromEntries(forgeParityFixtures.map((fixture) => [fixture.id, evaluateFixture(fixture)]));
}

function rankFixturePack() {
  return rankPlayers({
    requestId: 'fixture-pack-rankings',
    players: forgeParityPlayers,
    context: forgeParityContext,
    includeExplanations: true
  });
}

test('fixture pack stays deterministic for identical evaluate requests', () => {
  for (const fixture of forgeParityFixtures) {
    const first = evaluateFixture(fixture);
    const second = evaluateFixture(fixture);

    assert.deepEqual(second, first, `fixture ${fixture.id} should evaluate deterministically`);
  }
});

test('fixture pack preserves core relative ordering in rankings output', () => {
  const rankings = rankFixturePack();

  assert.deepEqual(
    rankings.rankings.map((entry) => entry.player.playerId),
    ['elite-1', 'steady-1', 'mid-1', 'volatile-1', 'weak-1', 'lowavail-1']
  );

  const byId = Object.fromEntries(rankings.rankings.map((entry) => [entry.player.playerId, entry]));
  assert.ok(byId['elite-1'].score.overall > byId['weak-1'].score.overall);
  assert.ok(byId['mid-1'].score.overall > byId['lowavail-1'].score.overall);
  assert.ok(byId['steady-1'].score.overall > byId['volatile-1'].score.overall);
});

test('fixture pack applies meaningful weak-opportunity and low-availability penalties', () => {
  const evaluations = evaluateFixtures();
  const weakOpportunity = evaluations['weak-opportunity'];
  const lowAvailability = evaluations['low-availability'];
  const midTierStable = evaluations['mid-tier-stable'];

  const weakOpportunityComponent = weakOpportunity.score.components.find((component) => component.key === 'opportunity');
  const lowAvailabilityComponent = lowAvailability.score.components.find((component) => component.key === 'availability');

  assert.ok(weakOpportunity.score.overall < midTierStable.score.overall);
  assert.ok(lowAvailability.score.overall < midTierStable.score.overall);
  assert.ok(weakOpportunityComponent.score < 50);
  assert.match(weakOpportunityComponent.reason, /weak-opportunity range/);
  assert.ok(lowAvailabilityComponent.score < 30);
  assert.equal(lowAvailability.confidence.label, 'low');
});

test('fixture pack keeps confidence coherent across safer and shakier scenarios', () => {
  const evaluations = evaluateFixtures();
  const elite = evaluations['elite-high-end'];
  const stable = evaluations['high-end-steady'];
  const volatile = evaluations['volatile-questionable'];
  const weakOpportunity = evaluations['weak-opportunity'];
  const lowAvailability = evaluations['low-availability'];

  assert.equal(elite.confidence.label, 'high');
  assert.equal(stable.confidence.label, 'high');
  assert.equal(lowAvailability.confidence.label, 'low');
  assert.ok(elite.confidence.score > volatile.confidence.score);
  assert.ok(stable.confidence.score > weakOpportunity.confidence.score);
  assert.ok(volatile.confidence.score > lowAvailability.confidence.score);
});

test('fixture pack rankings remain deterministic across repeated evaluations', () => {
  const first = rankFixturePack();
  const second = rankFixturePack();

  assert.deepEqual(second, first);
});
