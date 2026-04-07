const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { artifactPathForRequest } = require('../scripts/inspect-football-artifact-grades.js');

test('artifactPathForRequest supports --artifact-template for derived_skill weekly selection', () => {
  const resolved = artifactPathForRequest({
    artifactKind: 'derived_skill',
    season: 2024,
    week: 6,
    artifactPath: undefined,
    artifactTemplate: 'tests/fixtures/artifacts/forge_weekly_player_input_{season}_w{week}.skill_positions_offline_fixture.derived.json',
    useRealTiberData: false
  });

  assert.equal(
    resolved,
    path.resolve(process.cwd(), 'tests/fixtures/artifacts/forge_weekly_player_input_2024_w06.skill_positions_offline_fixture.derived.json')
  );
});

test('artifactPathForRequest keeps explicit --artifact-path override as highest priority', () => {
  const resolved = artifactPathForRequest({
    artifactKind: 'derived_skill',
    season: 2024,
    week: 6,
    artifactPath: 'tests/fixtures/artifacts/forge_weekly_player_input_2024_w01.skill_positions_offline_fixture.derived.json',
    artifactTemplate: 'tests/fixtures/artifacts/forge_weekly_player_input_{season}_w{week}.skill_positions_offline_fixture.derived.json',
    useRealTiberData: true
  });

  assert.equal(
    resolved,
    path.resolve(process.cwd(), 'tests/fixtures/artifacts/forge_weekly_player_input_2024_w01.skill_positions_offline_fixture.derived.json')
  );
});

test('--use-real-tiber-data resolves current TIBER-Data skill_offline_fixture naming', () => {
  const resolved = artifactPathForRequest({
    artifactKind: 'derived_skill',
    season: 2024,
    week: 6,
    artifactPath: undefined,
    artifactTemplate: undefined,
    useRealTiberData: true
  });

  assert.equal(
    resolved,
    path.resolve(process.cwd(), '../TIBER-Data/data/gold/forge/forge_weekly_player_input_2024_w06.skill_offline_fixture.derived.json')
  );
});
