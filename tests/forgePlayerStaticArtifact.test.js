const assert = require('node:assert/strict');
const { readFile, mkdtemp } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const { ingestSourceBackedCohortArtifact } = require('../dist/src/ingestion/sourceBackedCohortArtifact.js');
const { rankSeasonPlayers } = require('../dist/src/services/seasonForgeService.js');
const { buildForgePlayerStaticArtifact } = require('../dist/src/services/playerStaticArtifactService.js');
const { DEFAULT_OUTPUT_PATH, parseArgs } = require('../scripts/build-player-static-artifact.js');

const cohortFixturePath = path.resolve(process.cwd(), 'tests/fixtures/artifacts/forge_player_weekly_ppr_2025.cohort.v1.json');
const promotedArtifactPath = path.resolve(process.cwd(), DEFAULT_OUTPUT_PATH);

async function buildFixtureStaticArtifact() {
  const ingestion = await ingestSourceBackedCohortArtifact(cohortFixturePath);
  const rankings = rankSeasonPlayers(ingestion.inputs, { artifactPath: cohortFixturePath, cohortMetadata: ingestion.metadata });
  return buildForgePlayerStaticArtifact(ingestion.inputs, rankings, {
    generatedAt: ingestion.metadata.asOf,
    sourceArtifacts: ['tests/fixtures/artifacts/forge_player_weekly_ppr_2025.cohort.v1.json'],
    sourceProvider: ingestion.metadata.sourceProvider
  });
}

test('FORGE_PLAYER_STATIC_V1 builder emits player-specific evidence rows with explicit unsupported components', async () => {
  const artifact = await buildFixtureStaticArtifact();

  assert.equal(artifact.schema_version, 'forge_player_static_v1');
  assert.equal(artifact.artifact_type, 'FORGE_PLAYER_STATIC_V1');
  assert.equal(artifact.row_count, 2);
  assert.ok(artifact.warnings.some((warning) => /evidence compiler artifact/i.test(warning)));

  for (const row of artifact.rows) {
    assert.equal(row.schema_version, 'forge_player_static_v1');
    assert.match(row.player_id, /^cohort-/);
    assert.equal(row.provenance.score_source, 'player_specific');
    assert.equal(row.provenance.source_provider, 'TIBER-Data');
    assert.equal(row.provenance.input_mode, 'source-backed-cohort');
    assert.equal(row.components.production_profile.evidence_status, 'player_specific');
    assert.equal(row.components.role_security.evidence_status, 'player_specific');
    assert.equal(typeof row.components.production_profile.score, 'number');
    assert.equal(typeof row.components.role_security.score, 'number');
    assert.equal(row.components.age_curve.score, null);
    assert.equal(row.components.age_curve.evidence_status, 'unsupported_by_input');
    assert.equal(row.components.market_strength.score, null);
    assert.equal(row.components.positional_leverage.evidence_status, 'unsupported_by_input');
    assert.ok(row.evidence_summary.some((item) => /Unsupported static components remain null/i.test(item)));
  }
});

test('promoted static artifact matches deterministic builder output', async () => {
  const expected = await buildFixtureStaticArtifact();
  const promoted = JSON.parse(await readFile(promotedArtifactPath, 'utf8'));

  assert.deepEqual(promoted, expected);
});

test('player static artifact script can write a deterministic promoted artifact path', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'forge-player-static-'));
  const outputPath = path.join(dir, 'forge_player_static_v1.json');

  const { stdout } = await execFileAsync(process.execPath, ['scripts/build-player-static-artifact.js', '--output', outputPath], { cwd: process.cwd() });
  const written = JSON.parse(await readFile(outputPath, 'utf8'));

  assert.match(stdout, /Wrote FORGE_PLAYER_STATIC_V1 \(2 rows\)/);
  assert.equal(written.artifact_type, 'FORGE_PLAYER_STATIC_V1');
  assert.equal(written.rows.every((row) => row.provenance.score_source === 'player_specific'), true);
});

test('player static artifact script arguments parse explicitly', () => {
  assert.deepEqual(parseArgs(['--source-backed-cohort', 'cohort.json', '--output', 'static.json']), {
    sourceBackedCohortPath: 'cohort.json',
    outputPath: 'static.json'
  });
});
