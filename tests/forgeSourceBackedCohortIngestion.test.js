const assert = require('node:assert/strict');
const { mkdtemp, readFile, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { ingestSourceBackedCohortArtifact } = require('../dist/src/ingestion/sourceBackedCohortArtifact.js');
const { rankSeasonPlayers } = require('../dist/src/services/seasonForgeService.js');
const { ingestForgeSeasonArtifact } = require('../dist/src/ingestion/forgeSeasonArtifact.js');

const cohortFixturePath = path.resolve(process.cwd(), 'tests/fixtures/artifacts/forge_player_weekly_ppr_2025.cohort.v1.json');
const seasonFixturePath = path.resolve(process.cwd(), 'tests/fixtures/artifacts/forge_season_player_input_2025.sample.json');

async function writeMutatedArtifact(mutator) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'forge-cohort-'));
  const target = path.join(dir, 'cohort.json');
  const artifact = JSON.parse(await readFile(cohortFixturePath, 'utf8'));
  mutator(artifact);
  await writeFile(target, JSON.stringify(artifact, null, 2));
  return target;
}

async function rejectsClearly(artifactPath, pattern) {
  await assert.rejects(
    () => ingestSourceBackedCohortArtifact(artifactPath),
    (error) => {
      assert.equal(error.code, 'SOURCE_BACKED_COHORT_INVALID_SHAPE');
      assert.match(`${error.message} ${JSON.stringify(error.details)}`, pattern);
      return true;
    }
  );
}

test('valid source-backed cohort artifact loads successfully', async () => {
  const ingestion = await ingestSourceBackedCohortArtifact(cohortFixturePath);

  assert.equal(ingestion.metadata.buildId, 'td-2025-cohort-build-001');
  assert.equal(ingestion.metadata.sourceProvider, 'TIBER-Data');
  assert.equal(ingestion.inputs.length, 24);
  assert.ok(ingestion.inputs.length > 8);
  assert.ok(ingestion.inputs.every((input) => input.inputMode === 'source-backed-cohort'));
  assert.ok(ingestion.inputs.every((input) => input.sourceBackedCohort?.artifactContract === 'forge_player_weekly_ppr_2025.cohort.v1'));
});


test('2026 source-backed cohort artifact loads and keeps the numeric season', async () => {
  const futurePath = await writeMutatedArtifact((artifact) => {
    artifact.season = 2026;
    artifact.buildId = 'td-2026-cohort-build-001';
  });

  const ingestion = await ingestSourceBackedCohortArtifact(futurePath);
  const result = rankSeasonPlayers(ingestion.inputs, { artifactPath: futurePath, cohortMetadata: ingestion.metadata });

  assert.equal(ingestion.metadata.season, 2026);
  assert.equal(ingestion.metadata.artifactContract, 'forge_player_weekly_ppr_2026.cohort.v1');
  assert.ok(ingestion.inputs.every((input) => input.season === 2026));
  assert.ok(ingestion.inputs.every((input) => input.sourceBackedCohort?.artifactContract === 'forge_player_weekly_ppr_2026.cohort.v1'));
  assert.equal(result.season, 2026);
  assert.equal(result.cohortMetadata.season, 2026);
});

test('malformed source-backed cohort artifact fails clearly', async () => {
  const malformedPath = await writeMutatedArtifact((artifact) => {
    artifact.players[0].position = 'K';
  });

  await rejectsClearly(malformedPath, /position must be one of: QB, RB, WR, TE/);
});

test('source-backed cohort season total mismatch fails validation', async () => {
  const mismatchPath = await writeMutatedArtifact((artifact) => {
    artifact.players[0].seasonTotal.pprPoints = 45;
  });

  await rejectsClearly(mismatchPath, /pprPoints \(45\) must equal weeklyRows sum \(46\)/);
});

test('source-backed cohort missing metadata fails validation', async () => {
  const missingMetadataPath = await writeMutatedArtifact((artifact) => {
    delete artifact.buildId;
  });

  await rejectsClearly(missingMetadataPath, /buildId must be a non-empty string/);
});

test('source-backed cohort rejects fixture, sample, offline, and projection semantics', async () => {
  const forbiddenPath = await writeMutatedArtifact((artifact) => {
    artifact.source.provider = 'offline-projection-fixture';
  });

  await rejectsClearly(forbiddenPath, /must not contain offline semantics|must not contain projection semantics|must not contain fixture semantics/);
});

test('FORGE grading works against the source-backed cohort artifact', async () => {
  const ingestion = await ingestSourceBackedCohortArtifact(cohortFixturePath);
  const result = rankSeasonPlayers(ingestion.inputs, { artifactPath: cohortFixturePath, cohortMetadata: ingestion.metadata });

  assert.equal(result.inputMode, 'source-backed-cohort');
  assert.equal(result.cohortMetadata.artifactPath, cohortFixturePath);
  assert.equal(result.cohortMetadata.buildId, 'td-2025-cohort-build-001');
  assert.equal(result.cohortMetadata.sourceProvider, 'TIBER-Data');
  assert.equal(result.cohortMetadata.playerCount, 24);
  assert.equal(result.cohortMetadata.season, 2025);
  assert.equal(result.rankings.length, 24);
  assert.ok(result.warnings.some((warning) => /Source-backed TIBER-Data cohort mode/i.test(warning)));
  assert.ok(result.rankings.some((entry) => entry.warnings.some((warning) => /Source quality flag: late_stat_correction/i.test(warning))));
});

test('fixture path still works unchanged', async () => {
  const inputs = await ingestForgeSeasonArtifact(seasonFixturePath);
  const result = rankSeasonPlayers(inputs);

  assert.equal(result.inputMode, 'fixture');
  assert.equal(result.cohortMetadata, undefined);
  assert.ok(result.warnings.some((warning) => /Fixture-backed local 2025 season prototype/i.test(warning)));
  assert.ok(inputs.every((input) => input.fixtureSemantics === 'sample-only-retrospective-fixture'));
});

test('inspect season grades supports source-backed cohort option', () => {
  const { parseArgs } = require('../scripts/inspect-season-grades.js');

  assert.deepEqual(parseArgs(['--source-backed-cohort', 'cohort.json', '--json']), {
    artifactPath: 'tests/fixtures/artifacts/forge_season_player_input_2025.sample.json',
    sourceBackedCohortPath: 'cohort.json',
    json: true
  });
});
