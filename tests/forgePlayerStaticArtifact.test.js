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
const { buildForgePlayerStaticArtifact, validateForgePlayerStaticConsumerContract } = require('../dist/src/services/playerStaticArtifactService.js');
const { DEFAULT_GENERATED_BASELINE_SEASON_PATHS, DEFAULT_OUTPUT_PATH, DEFAULT_SOURCE_BACKED_COHORT_PATHS, parseArgs } = require('../scripts/build-player-static-artifact.js');

const cohortFixturePaths = DEFAULT_SOURCE_BACKED_COHORT_PATHS.map((cohortPath) => path.resolve(process.cwd(), cohortPath));
const primaryCohortFixturePath = cohortFixturePaths[0];
const promotedArtifactPath = path.resolve(process.cwd(), DEFAULT_OUTPUT_PATH);
const generatedBaselineFixturePath = path.resolve(process.cwd(), DEFAULT_GENERATED_BASELINE_SEASON_PATHS[0]);
const realCanonicalPlayerIds = [
  'tiber-data-player-2025-amon-ra-st-brown',
  'tiber-data-player-2025-bijan-robinson',
  'tiber-data-player-2025-breece-hall',
  'tiber-data-player-2025-brock-bowers',
  'tiber-data-player-2025-calvin-austin-iii',
  'tiber-data-player-2025-ceedee-lamb',
  'tiber-data-player-2025-christian-mccaffrey',
  'tiber-data-player-2025-cj-stroud',
  'tiber-data-player-2025-deebo-samuel-sr',
  'tiber-data-player-2025-derrick-henry',
  'tiber-data-player-2025-devon-achane',
  'tiber-data-player-2025-gardner-minshew',
  'tiber-data-player-2025-george-kittle',
  'tiber-data-player-2025-harold-fannin-jr',
  'tiber-data-player-2025-jahmyr-gibbs',
  'tiber-data-player-2025-jalen-hurts',
  'tiber-data-player-2025-jalen-tolbert',
  'tiber-data-player-2025-jamarr-chase',
  'tiber-data-player-2025-jameis-winston',
  'tiber-data-player-2025-jonathan-taylor',
  'tiber-data-player-2025-josh-allen',
  'tiber-data-player-2025-justin-herbert',
  'tiber-data-player-2025-justin-jefferson',
  'tiber-data-player-2025-kendrick-bourne',
  'tiber-data-player-2025-ladd-mcconkey',
  'tiber-data-player-2025-lamar-jackson',
  'tiber-data-player-2025-luther-burden-iii',
  'tiber-data-player-2025-mac-jones',
  'tiber-data-player-2025-malik-davis',
  'tiber-data-player-2025-mark-andrews',
  'tiber-data-player-2025-marvin-mims-jr',
  'tiber-data-player-2025-nico-collins',
  'tiber-data-player-2025-patrick-mahomes',
  'tiber-data-player-2025-puka-nacua',
  'tiber-data-player-2025-rico-dowdle',
  'tiber-data-player-2025-ryan-flournoy',
  'tiber-data-player-2025-sam-laporta',
  'tiber-data-player-2025-saquon-barkley',
  'tiber-data-player-2025-t-j-hockenson',
  'tiber-data-player-2025-terrance-ferguson',
  'tiber-data-player-2025-travis-hunter',
  'tiber-data-player-2025-travis-kelce',
  'tiber-data-player-2025-trey-mcbride',
  'tiber-data-player-2025-tyquan-thornton',
  'tiber-data-player-2025-xavier-worthy'
];

async function buildFixtureStaticArtifact() {
  const ingestions = await Promise.all(cohortFixturePaths.map((cohortPath) => ingestSourceBackedCohortArtifact(cohortPath)));
  const generatedBaselineInputs = await ingestForgeSeasonArtifact(generatedBaselineFixturePath);
  const inputs = [...ingestions.flatMap((ingestion) => ingestion.inputs), ...generatedBaselineInputs];
  const rankings = rankSeasonPlayers(inputs);
  return buildForgePlayerStaticArtifact(inputs, rankings, {
    generatedAt: ingestions[0].metadata.asOf,
    sourceArtifacts: [...DEFAULT_SOURCE_BACKED_COHORT_PATHS, ...DEFAULT_GENERATED_BASELINE_SEASON_PATHS]
  });
}

test('FORGE_PLAYER_STATIC_V1 builder emits player-specific evidence rows with explicit unsupported components', async () => {
  const artifact = await buildFixtureStaticArtifact();

  assert.equal(artifact.schema_version, 'forge_player_static_v1');
  assert.equal(artifact.artifact_type, 'FORGE_PLAYER_STATIC_V1');
  assert.equal(artifact.row_count, 59);

  const sourceCounts = artifact.rows.reduce((counts, row) => {
    counts[row.provenance.score_source] = (counts[row.provenance.score_source] ?? 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(sourceCounts, { player_specific: 45, generated_baseline: 14 });
  assert.ok(sourceCounts.player_specific > 8);
  assert.ok(artifact.warnings.some((warning) => /evidence compiler artifact/i.test(warning)));

  for (const row of artifact.rows.filter((candidate) => candidate.provenance.score_source === 'player_specific')) {
    assert.equal(row.schema_version, 'forge_player_static_v1');
    assert.ok(row.player_id.startsWith('tiber-data-player-2025-'));
    assert.ok(!row.player_id.startsWith('cohort-'));
    assert.equal(row.provenance.score_source, 'player_specific');
    assert.ok(['TIBER-Data', 'FantasyPros'].includes(row.provenance.source_provider));
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

test('FORGE_PLAYER_STATIC_V1 promoted artifact satisfies downstream consumer conformance contract', async () => {
  const promoted = JSON.parse(await readFile(promotedArtifactPath, 'utf8'));
  const conformance = validateForgePlayerStaticConsumerContract(promoted);

  assert.equal(conformance.valid, true);
  assert.deepEqual(conformance.errors, []);
  assert.deepEqual(conformance.warnings, []);
  assert.deepEqual(conformance.counters, {
    player_specific_coverage: 45,
    generated_baseline_visibility: 14,
    unresolved_identity_misses: 0,
    unsupported_missing_artifact_state: 0
  });
  assert.equal(promoted.consumer_manifest.evidence_gate.player_specific_forge_evidence, 'row.provenance.score_source === "player_specific"');
  assert.deepEqual(promoted.consumer_manifest.evidence_gate.non_evidence_score_sources, ['fallback_default', 'generated_baseline']);
  assert.equal(promoted.consumer_manifest.fail_closed_behavior.missing_artifact, 'unavailable_forge_evidence');
  assert.equal(promoted.consumer_manifest.fail_closed_behavior.malformed_artifact, 'unavailable_forge_evidence');
  assert.equal(promoted.consumer_manifest.fail_closed_behavior.duplicate_player_ids, 'invalid_artifact');
  assert.equal(promoted.consumer_manifest.fail_closed_behavior.unknown_score_source, 'non_evidence_unless_explicitly_supported');
});

test('FORGE_PLAYER_STATIC_V1 consumer conformance fails closed for missing, malformed, and duplicate artifacts', async () => {
  const promoted = JSON.parse(await readFile(promotedArtifactPath, 'utf8'));
  const missing = validateForgePlayerStaticConsumerContract(undefined);
  const malformed = validateForgePlayerStaticConsumerContract({ ...promoted, rows: 'not-rows' });
  const duplicate = validateForgePlayerStaticConsumerContract({
    ...promoted,
    row_count: promoted.rows.length + 1,
    rows: [...promoted.rows, { ...promoted.rows[0] }]
  });

  assert.equal(missing.valid, false);
  assert.equal(missing.counters.unsupported_missing_artifact_state, 1);
  assert.ok(missing.errors.some((error) => /artifact is missing/i.test(error)));

  assert.equal(malformed.valid, false);
  assert.equal(malformed.counters.unsupported_missing_artifact_state, 1);
  assert.ok(malformed.errors.some((error) => /rows must be an array/i.test(error)));

  assert.equal(duplicate.valid, false);
  assert.equal(duplicate.counters.unsupported_missing_artifact_state, 1);
  assert.ok(duplicate.errors.some((error) => /Duplicate player_id/i.test(error)));
});

test('FORGE_PLAYER_STATIC_V1 consumer conformance treats unknown score_source as non-evidence', async () => {
  const promoted = JSON.parse(await readFile(promotedArtifactPath, 'utf8'));
  const generatedBaselineIndex = promoted.rows.findIndex((row) => row.provenance.score_source === 'generated_baseline');
  const rows = [...promoted.rows];
  rows[generatedBaselineIndex] = {
    ...rows[generatedBaselineIndex],
    provenance: {
      ...rows[generatedBaselineIndex].provenance,
      score_source: 'future_unknown_source'
    }
  };
  const unknownSourceArtifact = {
    ...promoted,
    rows
  };
  const conformance = validateForgePlayerStaticConsumerContract(unknownSourceArtifact);

  assert.equal(conformance.valid, true);
  assert.equal(conformance.counters.player_specific_coverage, 45);
  assert.equal(conformance.counters.generated_baseline_visibility, 13);
  assert.ok(conformance.warnings.some((warning) => /not explicitly supported and must be treated as non-evidence/i.test(warning)));
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


test('FORGE_PLAYER_STATIC_V1 player-specific coverage uses only real canonical player ids without duplicate canonical ids', async () => {
  const artifact = await buildFixtureStaticArtifact();
  const playerSpecificRows = artifact.rows.filter((row) => row.provenance.score_source === 'player_specific');
  const canonicalIds = artifact.rows.map((row) => row.player_id);
  const playerSpecificIds = playerSpecificRows.map((row) => row.player_id);
  const placeholderRows = playerSpecificRows.filter((row) => row.player_id.startsWith('cohort-'));

  assert.equal(playerSpecificRows.length, realCanonicalPlayerIds.length);
  assert.ok(playerSpecificRows.length > 8);
  assert.equal(new Set(canonicalIds).size, canonicalIds.length);
  assert.deepEqual([...playerSpecificIds].sort(), realCanonicalPlayerIds);
  assert.equal(placeholderRows.length, 0);
});



const newlyMappedManagementPromotions = [
  'tiber-data-player-2025-calvin-austin-iii',
  'tiber-data-player-2025-christian-mccaffrey',
  'tiber-data-player-2025-deebo-samuel-sr',
  'tiber-data-player-2025-derrick-henry',
  'tiber-data-player-2025-gardner-minshew',
  'tiber-data-player-2025-harold-fannin-jr',
  'tiber-data-player-2025-jalen-tolbert',
  'tiber-data-player-2025-jameis-winston',
  'tiber-data-player-2025-kendrick-bourne',
  'tiber-data-player-2025-ladd-mcconkey',
  'tiber-data-player-2025-luther-burden-iii',
  'tiber-data-player-2025-mac-jones',
  'tiber-data-player-2025-malik-davis',
  'tiber-data-player-2025-marvin-mims-jr',
  'tiber-data-player-2025-rico-dowdle',
  'tiber-data-player-2025-ryan-flournoy',
  'tiber-data-player-2025-t-j-hockenson',
  'tiber-data-player-2025-terrance-ferguson',
  'tiber-data-player-2025-travis-hunter',
  'tiber-data-player-2025-tyquan-thornton',
  'tiber-data-player-2025-xavier-worthy'
];

const omittedManagementCandidates = [
  'tiber-data-player-2025-frank-gore-jr'
];

test('FORGE_PLAYER_STATIC_V1 promotes only evidence-backed newly mapped Management candidates', async () => {
  const artifact = await buildFixtureStaticArtifact();
  const rowsByPlayerId = new Map(artifact.rows.map((row) => [row.player_id, row]));

  for (const playerId of newlyMappedManagementPromotions) {
    const row = rowsByPlayerId.get(playerId);
    assert.ok(row, `${playerId} should have a player-specific static row.`);
    assert.equal(row.provenance.score_source, 'player_specific');
    assert.equal(row.provenance.input_mode, 'source-backed-cohort');
    assert.ok(row.provenance.source_provider);
    assert.ok(row.provenance.source_set_id);
    assert.ok(row.provenance.source_updated_at);
    assert.equal(row.components.production_profile.evidence_status, 'player_specific');
    assert.equal(row.components.role_security.evidence_status, 'player_specific');
  }

  for (const playerId of omittedManagementCandidates) {
    assert.equal(rowsByPlayerId.has(playerId), false, `${playerId} should not be silently promoted without source-backed FORGE evidence.`);
  }
});

test('FORGE_PLAYER_STATIC_V1 builder preserves duplicate canonical player id guard', async () => {
  const ingestion = await ingestSourceBackedCohortArtifact(primaryCohortFixturePath);
  const duplicateInputs = [...ingestion.inputs, { ...ingestion.inputs[0] }];
  const rankings = rankSeasonPlayers(ingestion.inputs);

  assert.throws(
    () => buildForgePlayerStaticArtifact(duplicateInputs, rankings),
    /Duplicate canonical player_id supplied to FORGE_PLAYER_STATIC_V1 builder/
  );
});

test('FORGE_PLAYER_STATIC_V1 player-specific rows preserve TIBER-Data provenance semantics', async () => {
  const artifact = await buildFixtureStaticArtifact();
  const realRows = artifact.rows.filter((row) => row.provenance.source_set_id === 'td-2025-cohort-build-001');

  assert.equal(realRows.length, 24);
  assert.deepEqual(artifact.source_artifacts, [...DEFAULT_SOURCE_BACKED_COHORT_PATHS, ...DEFAULT_GENERATED_BASELINE_SEASON_PATHS]);

  for (const row of realRows) {
    assert.equal(row.provenance.score_source, 'player_specific');
    assert.equal(row.provenance.source_provider, 'TIBER-Data');
    assert.equal(row.provenance.input_mode, 'source-backed-cohort');
    assert.equal(row.provenance.source_set_id, 'td-2025-cohort-build-001');
    assert.deepEqual(row.provenance.source_artifacts, artifact.source_artifacts);
    assert.ok(row.evidence_summary.some((item) => /score_source=player_specific/i.test(item)));
  }
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

  assert.match(stdout, /Wrote FORGE_PLAYER_STATIC_V1 \(59 rows\)/);
  assert.equal(written.artifact_type, 'FORGE_PLAYER_STATIC_V1');
  assert.equal(written.rows.filter((row) => row.provenance.score_source === 'player_specific').length, 45);
  assert.equal(written.rows.filter((row) => row.provenance.score_source === 'generated_baseline').length, 14);
});

test('player static artifact script arguments parse explicitly', () => {
  assert.deepEqual(parseArgs(['--source-backed-cohort', 'cohort.json', '--generated-baseline-season', 'baseline.json', '--output', 'static.json']), {
    sourceBackedCohortPaths: ['cohort.json'],
    generatedBaselineSeasonPaths: [...DEFAULT_GENERATED_BASELINE_SEASON_PATHS, 'baseline.json'],
    outputPath: 'static.json'
  });
  assert.deepEqual(parseArgs(['--no-generated-baselines', '--output', 'static.json']), {
    sourceBackedCohortPaths: DEFAULT_SOURCE_BACKED_COHORT_PATHS,
    generatedBaselineSeasonPaths: [],
    outputPath: 'static.json'
  });
});
