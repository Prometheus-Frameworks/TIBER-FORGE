const assert = require('node:assert/strict');
const { readFile, mkdtemp } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const { ingestSourceBackedCohortArtifact } = require('../dist/src/ingestion/sourceBackedCohortArtifact.js');
const { ingestForgeSeasonArtifact } = require('../dist/src/ingestion/forgeSeasonArtifact.js');
const { rankSeasonPlayers } = require('../dist/src/services/seasonForgeService.js');
const { buildForgePlayerStaticArtifact } = require('../dist/src/services/playerStaticArtifactService.js');
const { DEFAULT_GENERATED_BASELINE_SEASON_PATHS, DEFAULT_OUTPUT_PATH, parseArgs } = require('../scripts/build-player-static-artifact.js');

const cohortFixturePath = path.resolve(process.cwd(), 'tests/fixtures/artifacts/forge_player_weekly_ppr_2025.cohort.v1.json');
const promotedArtifactPath = path.resolve(process.cwd(), DEFAULT_OUTPUT_PATH);
const generatedBaselineFixturePath = path.resolve(process.cwd(), DEFAULT_GENERATED_BASELINE_SEASON_PATHS[0]);

async function buildFixtureStaticArtifact() {
  const ingestion = await ingestSourceBackedCohortArtifact(cohortFixturePath);
  const generatedBaselineInputs = await ingestForgeSeasonArtifact(generatedBaselineFixturePath);
  const inputs = [...ingestion.inputs, ...generatedBaselineInputs];
  const rankings = rankSeasonPlayers(inputs);
  return buildForgePlayerStaticArtifact(inputs, rankings, {
    generatedAt: ingestion.metadata.asOf,
    sourceArtifacts: ['tests/fixtures/artifacts/forge_player_weekly_ppr_2025.cohort.v1.json', ...DEFAULT_GENERATED_BASELINE_SEASON_PATHS]
  });
}

test('FORGE_PLAYER_STATIC_V1 builder emits player-specific evidence rows with explicit unsupported components', async () => {
  const artifact = await buildFixtureStaticArtifact();

  assert.equal(artifact.schema_version, 'forge_player_static_v1');
  assert.equal(artifact.artifact_type, 'FORGE_PLAYER_STATIC_V1');
  assert.equal(artifact.row_count, 22);

  const sourceCounts = artifact.rows.reduce((counts, row) => {
    counts[row.provenance.score_source] = (counts[row.provenance.score_source] ?? 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(sourceCounts, { player_specific: 8, generated_baseline: 14 });
  assert.ok(artifact.warnings.some((warning) => /evidence compiler artifact/i.test(warning)));

  for (const row of artifact.rows.filter((candidate) => candidate.provenance.score_source === 'player_specific')) {
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

test('FORGE_PLAYER_STATIC_V1 builder explicitly labels generated baseline rows as non-player-specific', async () => {
  const artifact = await buildFixtureStaticArtifact();
  const generatedBaselineRows = artifact.rows.filter((row) => row.provenance.score_source === 'generated_baseline');

  assert.equal(generatedBaselineRows.length, 14);
  assert.ok(generatedBaselineRows.some((row) => row.player_name === 'Ja\'Marr Chase'));

  for (const row of generatedBaselineRows) {
    assert.equal(row.provenance.input_mode, 'fixture');
    assert.equal(row.provenance.source_provider, 'FORGE generated baseline fixture');
    assert.equal(row.components.production_profile.evidence_status, 'generated_baseline');
    assert.equal(row.components.role_security.evidence_status, 'generated_baseline');
    assert.ok(row.evidence_summary.some((item) => /must not be treated as player-specific evidence/i.test(item)));
    assert.ok(row.warnings.some((warning) => /not player-specific source-backed FORGE evidence/i.test(warning)));
  }
});


test('FORGE_PLAYER_STATIC_V1 player-specific coverage expands without duplicate canonical player ids', async () => {
  const artifact = await buildFixtureStaticArtifact();
  const playerSpecificRows = artifact.rows.filter((row) => row.provenance.score_source === 'player_specific');
  const canonicalIds = artifact.rows.map((row) => row.player_id);

  assert.equal(playerSpecificRows.length, 8);
  assert.ok(playerSpecificRows.length > 2);
  assert.equal(new Set(canonicalIds).size, canonicalIds.length);
});

test('FORGE_PLAYER_STATIC_V1 builder output is stable across repeated builds', async () => {
  const first = await buildFixtureStaticArtifact();
  const second = await buildFixtureStaticArtifact();

  assert.deepEqual(second, first);
});

test('FORGE_PLAYER_STATIC_V1 builder keeps deterministic rank ordering by score then canonical player_id', async () => {
  const artifact = await buildFixtureStaticArtifact();
  const orderKeys = artifact.rows.map((row) => [row.forge_alpha, row.player_id]);
  const expectedOrderKeys = [...orderKeys].sort((left, right) => right[0] - left[0] || left[1].localeCompare(right[1]));

  assert.deepEqual(orderKeys, expectedOrderKeys);
});

test('player static artifact script can write a deterministic promoted artifact path', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'forge-player-static-'));
  const outputPath = path.join(dir, 'forge_player_static_v1.json');

  const { stdout } = await execFileAsync(process.execPath, ['scripts/build-player-static-artifact.js', '--output', outputPath], { cwd: process.cwd() });
  const written = JSON.parse(await readFile(outputPath, 'utf8'));

  assert.match(stdout, /Wrote FORGE_PLAYER_STATIC_V1 \(22 rows\)/);
  assert.equal(written.artifact_type, 'FORGE_PLAYER_STATIC_V1');
  assert.equal(written.rows.filter((row) => row.provenance.score_source === 'player_specific').length, 8);
  assert.equal(written.rows.filter((row) => row.provenance.score_source === 'generated_baseline').length, 14);
});

test('player static artifact script arguments parse explicitly', () => {
  assert.deepEqual(parseArgs(['--source-backed-cohort', 'cohort.json', '--generated-baseline-season', 'baseline.json', '--output', 'static.json']), {
    sourceBackedCohortPath: 'cohort.json',
    generatedBaselineSeasonPaths: [...DEFAULT_GENERATED_BASELINE_SEASON_PATHS, 'baseline.json'],
    outputPath: 'static.json'
  });
  assert.deepEqual(parseArgs(['--no-generated-baselines', '--output', 'static.json']), {
    sourceBackedCohortPath: 'tests/fixtures/artifacts/forge_player_weekly_ppr_2025.cohort.v1.json',
    generatedBaselineSeasonPaths: [],
    outputPath: 'static.json'
  });
});
