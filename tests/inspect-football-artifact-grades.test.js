const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { artifactPathForRequest, parseArgs } = require('../scripts/inspect-football-artifact-grades.js');

test('parseArgs supports real-data and template options', () => {
  const options = parseArgs([
    '--artifact-kind',
    'derived_skill',
    '--season',
    '2024',
    '--week',
    '6',
    '--artifact-template',
    '../TIBER-Data/data/gold/forge/forge_weekly_player_input_{season}_w{week}.skill_positions_season_segment.derived.json',
    '--use-real-tiber-data'
  ]);

  assert.equal(options.artifactKind, 'derived_skill');
  assert.equal(options.season, 2024);
  assert.equal(options.week, 6);
  assert.equal(options.useRealTiberData, true);
  assert.match(options.artifactTemplate, /\{season\}.*\{week\}/);
});

test('artifactPathForRequest keeps explicit --artifact-path override highest priority', () => {
  const resolved = artifactPathForRequest({
    artifactKind: 'derived_skill',
    season: 2024,
    week: 6,
    artifactPath: 'tests/fixtures/artifacts/forge_weekly_player_input_2024_w06.skill_positions_offline_fixture.derived.json',
    artifactTemplate: undefined,
    useRealTiberData: true
  });

  assert.equal(
    resolved,
    path.resolve(
      process.cwd(),
      'tests/fixtures/artifacts/forge_weekly_player_input_2024_w06.skill_positions_offline_fixture.derived.json'
    )
  );
});

test('artifactPathForRequest resolves real TIBER-Data template for derived_skill week requests', () => {
  const previousTemplate = process.env.FORGE_WEEKLY_DERIVED_SKILL_ARTIFACT_PATH_TEMPLATE;
  process.env.FORGE_WEEKLY_DERIVED_SKILL_ARTIFACT_PATH_TEMPLATE = 'tests/fixtures/artifacts/forge_weekly_player_input_{season}_w{week}.skill_positions_offline_fixture.derived.json';

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
    path.resolve(
      process.cwd(),
      '../TIBER-Data/data/gold/forge/forge_weekly_player_input_2024_w06.skill_positions_season_segment.derived.json'
    )
  );

  process.env.FORGE_WEEKLY_DERIVED_SKILL_ARTIFACT_PATH_TEMPLATE = previousTemplate;
});
