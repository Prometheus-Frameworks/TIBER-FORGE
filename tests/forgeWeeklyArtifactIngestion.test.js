const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ingestForgeWeeklyArtifact } = require('../dist/src/ingestion/forgeWeeklyArtifact.js');

const upstreamCompatMirrorPath = path.resolve(process.cwd(), 'tests/fixtures/artifacts/forge_weekly_player_input_2025_w12.upstream_compat.mirror.json');

test('ingestForgeWeeklyArtifact reads and validates upstream-compatible mirror artifact', async () => {
  const records = await ingestForgeWeeklyArtifact(upstreamCompatMirrorPath);

  assert.equal(records.length, 3);
  assert.equal(records[0].playerId, 'wr-featured-1');
  assert.equal(records[0].sourceSetId, 'td-weekly-2025-w12-sample-v1');
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
