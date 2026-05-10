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

const realPlayersFixturePath = path.resolve(process.cwd(), 'tests/fixtures/artifacts/forge_season_player_input_2025.real_players_sample.json');

async function gradeRealPlayersFixture() {
  const inputs = await ingestForgeSeasonArtifact(realPlayersFixturePath);
  return rankSeasonPlayers(inputs);
}

test('real-player 2025 season fixture validates with fixture-only semantics', async () => {
  const inputs = await ingestForgeSeasonArtifact(realPlayersFixturePath);

  assert.equal(inputs.length, 14);
  assert.ok(inputs.every((input) => input.contract === 'ForgeSeasonPlayerInput/v1'));
  assert.ok(inputs.every((input) => input.fixtureSemantics === 'sample-only-retrospective-fixture'));
  assert.ok(inputs.every((input) => input.season === 2025));
  assert.ok(inputs.every((input) => input.qualityFlags?.includes('real_player_fixture_sample')));
  assert.ok(inputs.every((input) => /not live TIBER-Data/i.test(input.sampleNote ?? '')));
});

test('real-player fixture rankings sort deterministically by score then playerId', async () => {
  const first = await gradeRealPlayersFixture();
  const second = await gradeRealPlayersFixture();

  assert.deepEqual(second, first);
  const sorted = [...first.rankings].sort((left, right) => right.score - left.score || left.player.playerId.localeCompare(right.player.playerId));
  assert.deepEqual(
    first.rankings.map((entry) => entry.player.playerId),
    sorted.map((entry) => entry.player.playerId)
  );
});

test('real-player obvious elite fantasy seasons grade high or elite', async () => {
  const result = await gradeRealPlayersFixture();
  const grades = byId(result);

  for (const id of [
    'real-player-2025-jamarr-chase-elite-wr-fixture',
    'real-player-2025-josh-allen-elite-qb-fixture',
    'real-player-2025-bijan-robinson-elite-rb-fixture',
    'real-player-2025-brock-bowers-elite-te-fixture'
  ]) {
    assert.match(['elite', 'high'].join(','), new RegExp(grades[id].tier));
    assert.ok(grades[id].score >= 75, `${id} should grade high enough for manual real-player calibration`);
  }
});

test('real-player TD-spike profiles show fragility warnings', async () => {
  const result = await gradeRealPlayersFixture();
  const grades = byId(result);

  for (const id of ['real-player-2025-mike-evans-td-spike-wr-fixture', 'real-player-2025-mark-andrews-td-spike-te-fixture']) {
    const fragility = component(grades[id], 'fragility');

    assert.ok(fragility.score < 60);
    assert.match(fragility.reason, /touchdown concentration/i);
    assert.ok(grades[id].warnings.some((warning) => /Fragility penalty/i.test(warning)));
  }
});

test('real-player injured star does not outrank full-season elite players', async () => {
  const result = await gradeRealPlayersFixture();
  const grades = byId(result);
  const injuredStar = grades['real-player-2025-christian-mccaffrey-injured-star-rb-fixture'];

  for (const id of [
    'real-player-2025-jamarr-chase-elite-wr-fixture',
    'real-player-2025-josh-allen-elite-qb-fixture',
    'real-player-2025-bijan-robinson-elite-rb-fixture',
    'real-player-2025-brock-bowers-elite-te-fixture'
  ]) {
    assert.ok(grades[id].score > injuredStar.score, `${id} should remain above the injured-star partial season`);
    assert.ok(grades[id].rank < injuredStar.rank, `${id} should rank above the injured-star partial season`);
  }
});

test('real-player low-volume efficiency does not outrank elite volume', async () => {
  const result = await gradeRealPlayersFixture();
  const grades = byId(result);
  const lowVolume = grades['real-player-2025-jameson-williams-low-volume-efficient-wr-fixture'];

  for (const id of [
    'real-player-2025-jamarr-chase-elite-wr-fixture',
    'real-player-2025-josh-allen-elite-qb-fixture',
    'real-player-2025-bijan-robinson-elite-rb-fixture',
    'real-player-2025-brock-bowers-elite-te-fixture'
  ]) {
    assert.ok(grades[id].score > lowVolume.score, `${id} should remain above low-volume efficiency`);
    assert.ok(grades[id].rank < lowVolume.rank, `${id} should rank above low-volume efficiency`);
  }

  assert.ok(lowVolume.warnings.some((warning) => /Low-volume sample/i.test(warning)));
});

test('inspect season grades supports real-player fixture shortcut', () => {
  const { REAL_PLAYERS_ARTIFACT_PATH, parseArgs } = require('../scripts/inspect-season-grades.js');

  assert.equal(parseArgs(['--real-players']).artifactPath, REAL_PLAYERS_ARTIFACT_PATH);
  assert.deepEqual(parseArgs(['--real-players', '--json']), { artifactPath: REAL_PLAYERS_ARTIFACT_PATH, json: true });
});
