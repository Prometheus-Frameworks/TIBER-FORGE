const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { ingestForgeSeasonArtifact } = require('../dist/src/ingestion/forgeSeasonArtifact.js');
const { rankSeasonPlayers } = require('../dist/src/services/seasonForgeService.js');

const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/artifacts/forge_season_player_input_2025.sample.json');

async function gradeFixture() {
  const inputs = await ingestForgeSeasonArtifact(fixturePath);
  return rankSeasonPlayers(inputs);
}

function byId(result) {
  return Object.fromEntries(result.rankings.map((entry) => [entry.player.playerId, entry]));
}

function component(entry, key) {
  return entry.components.find((item) => item.key === key);
}

test('local 2025 season artifact validates as ForgeSeasonPlayerInput/v1 fixture data', async () => {
  const inputs = await ingestForgeSeasonArtifact(fixturePath);

  assert.equal(inputs.length, 10);
  assert.ok(inputs.every((input) => input.contract === 'ForgeSeasonPlayerInput/v1'));
  assert.ok(inputs.every((input) => input.fixtureSemantics === 'sample-only-retrospective-fixture'));
  assert.ok(inputs.every((input) => input.season === 2025));
});

test('elite QB/RB/WR season samples grade elite or high', async () => {
  const result = await gradeFixture();
  const grades = byId(result);

  for (const id of ['season-2025-elite-wr', 'season-2025-elite-qb', 'season-2025-elite-rb']) {
    assert.match(['elite', 'high'].join(','), new RegExp(grades[id].tier));
    assert.ok(grades[id].score >= 75, `${id} should grade high enough for manual elite sanity-checking`);
  }
});

test('TD-spike player receives an explicit fragility penalty and warning', async () => {
  const result = await gradeFixture();
  const tdSpike = byId(result)['season-2025-td-spike-wr'];
  const fragility = component(tdSpike, 'fragility');

  assert.ok(fragility.score < 60);
  assert.match(fragility.reason, /touchdown concentration/i);
  assert.ok(tdSpike.warnings.some((warning) => /Fragility penalty/i.test(warning)));
});

test('low-volume efficient player does not outrank elite volume players', async () => {
  const result = await gradeFixture();
  const grades = byId(result);
  const lowVolume = grades['season-2025-low-volume-efficient-wr'];

  for (const id of ['season-2025-elite-wr', 'season-2025-elite-qb', 'season-2025-elite-rb']) {
    assert.ok(grades[id].score > lowVolume.score, `${id} should remain above the low-volume efficiency sample`);
    assert.ok(grades[id].rank < lowVolume.rank, `${id} should rank above the low-volume efficiency sample`);
  }

  assert.ok(lowVolume.warnings.some((warning) => /Low-volume sample/i.test(warning)));
});

test('season rankings sort deterministically by score then playerId', async () => {
  const first = await gradeFixture();
  const second = await gradeFixture();

  assert.deepEqual(second, first);
  const sorted = [...first.rankings].sort((left, right) => right.score - left.score || left.player.playerId.localeCompare(right.player.playerId));
  assert.deepEqual(
    first.rankings.map((entry) => entry.player.playerId),
    sorted.map((entry) => entry.player.playerId)
  );
});

test('season prototype warnings are clear about fixture/read-only retrospective scope', async () => {
  const result = await gradeFixture();
  const joined = result.warnings.join(' ');

  assert.match(joined, /Fixture-backed local 2025 season prototype/i);
  assert.match(joined, /Not live TIBER-Data/i);
  assert.match(joined, /Retrospective realized-season grading only/i);
});
