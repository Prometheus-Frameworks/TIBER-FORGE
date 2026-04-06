const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ingestForgeWeeklyArtifact } = require('../dist/src/ingestion/forgeWeeklyArtifact.js');

const upstreamCompatMirrorPath = path.resolve(process.cwd(), 'tests/fixtures/artifacts/forge_weekly_player_input_2025_w12.upstream_compat.mirror.json');
const derivedQbSlicePath = path.resolve(process.cwd(), 'tests/fixtures/artifacts/forge_weekly_player_input_2024_w01.qb_offline_fixture.derived.json');
const derivedSkillSlicePath = path.resolve(process.cwd(), 'tests/fixtures/artifacts/forge_weekly_player_input_2024_w01.skill_positions_offline_fixture.derived.json');
const derivedSkillWeek2Path = path.resolve(process.cwd(), 'tests/fixtures/artifacts/forge_weekly_player_input_2024_w02.skill_positions_offline_fixture.derived.json');
const derivedSkillWeek3Path = path.resolve(process.cwd(), 'tests/fixtures/artifacts/forge_weekly_player_input_2024_w03.skill_positions_offline_fixture.derived.json');

test('ingestForgeWeeklyArtifact reads and validates upstream-compatible mirror artifact', async () => {
  const records = await ingestForgeWeeklyArtifact(upstreamCompatMirrorPath);

  assert.equal(records.length, 3);
  assert.equal(records[0].playerId, 'wr-featured-1');
  assert.equal(records[0].sourceSetId, 'td-weekly-2025-w12-sample-v1');
});

test('ingestForgeWeeklyArtifact reads and validates first narrow derived QB slice artifact', async () => {
  const records = await ingestForgeWeeklyArtifact(derivedQbSlicePath);

  assert.equal(records.length, 2);
  assert.deepEqual(records.map((record) => record.position), ['QB', 'QB']);
  assert.equal(records[0].season, 2024);
  assert.equal(records[0].week, 1);
  assert.equal(records[0].sourceSetId, 'td-weekly-2024-w01-qb-offline-derived-v1');
});

test('ingestForgeWeeklyArtifact reads and validates broader skill-position derived artifact', async () => {
  const records = await ingestForgeWeeklyArtifact(derivedSkillSlicePath);

  assert.equal(records.length, 4);
  assert.deepEqual(records.map((record) => record.position), ['QB', 'RB', 'WR', 'TE']);
  assert.equal(records[0].season, 2024);
  assert.equal(records[0].week, 1);
  assert.ok(records.every((record) => record.sourceSetId === 'td-weekly-2024-w01-skill-offline-derived-v1'));
});


test('ingestForgeWeeklyArtifact reads and validates weekly-factory derived skill artifacts for weeks 2 and 3', async () => {
  const [week2Records, week3Records] = await Promise.all([ingestForgeWeeklyArtifact(derivedSkillWeek2Path), ingestForgeWeeklyArtifact(derivedSkillWeek3Path)]);

  assert.equal(week2Records.length, 4);
  assert.equal(week3Records.length, 4);
  assert.ok(week2Records.every((record) => record.week === 2));
  assert.ok(week3Records.every((record) => record.week === 3));
  assert.deepEqual(Array.from(new Set(week2Records.map((record) => record.position))).sort(), ['QB', 'RB', 'TE', 'WR']);
  assert.deepEqual(Array.from(new Set(week3Records.map((record) => record.position))).sort(), ['QB', 'RB', 'TE', 'WR']);
});

test('ingestForgeWeeklyArtifact fails closed for malformed JSON', async () => {
  const tmpPath = path.join(os.tmpdir(), `forge-artifact-malformed-${Date.now()}.json`);
  await fs.writeFile(tmpPath, '{"broken":', 'utf8');

  await assert.rejects(() => ingestForgeWeeklyArtifact(tmpPath), /ARTIFACT_INVALID_JSON|Malformed ForgeWeeklyPlayerInput artifact/);
});

test('ingestForgeWeeklyArtifact fails closed for invalid artifact shape', async () => {
  const tmpPath = path.join(os.tmpdir(), `forge-artifact-invalid-${Date.now()}.json`);
  await fs.writeFile(tmpPath, JSON.stringify([{ playerId: 'missing-required-fields' }]), 'utf8');

  await assert.rejects(() => ingestForgeWeeklyArtifact(tmpPath), /ARTIFACT_INVALID_SHAPE|Invalid ForgeWeeklyPlayerInput artifact/);
});
