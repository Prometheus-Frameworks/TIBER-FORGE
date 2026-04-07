const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function runInspect(args) {
  const stdout = execFileSync('node', ['scripts/inspect-football-artifact-grades.js', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  return JSON.parse(stdout);
}

test('inspect script supports --artifact-template for weekly derived_skill fixture selection', () => {
  const output = runInspect([
    '--artifact-kind',
    'derived_skill',
    '--season',
    '2024',
    '--week',
    '6',
    '--limit',
    '3',
    '--artifact-template',
    'tests/fixtures/artifacts/forge_weekly_player_input_{season}_w{week}.skill_positions_offline_fixture.derived.json'
  ]);

  assert.equal(
    output.artifactPath,
    path.resolve(process.cwd(), 'tests/fixtures/artifacts/forge_weekly_player_input_2024_w06.skill_positions_offline_fixture.derived.json')
  );
  assert.equal(output.returned, 3);
});

test('inspect script keeps explicit --artifact-path override as highest priority', () => {
  const output = runInspect([
    '--artifact-kind',
    'derived_skill',
    '--season',
    '2024',
    '--week',
    '6',
    '--artifact-template',
    'tests/fixtures/artifacts/forge_weekly_player_input_{season}_w{week}.skill_positions_offline_fixture.derived.json',
    '--use-real-tiber-data',
    '--artifact-path',
    'tests/fixtures/artifacts/forge_weekly_player_input_2024_w01.skill_positions_offline_fixture.derived.json'
  ]);

  assert.equal(
    output.artifactPath,
    path.resolve(process.cwd(), 'tests/fixtures/artifacts/forge_weekly_player_input_2024_w01.skill_positions_offline_fixture.derived.json')
  );
});
