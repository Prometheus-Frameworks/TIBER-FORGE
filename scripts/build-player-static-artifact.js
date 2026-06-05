#!/usr/bin/env node
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { ingestSourceBackedCohortArtifact } = require('../dist/src/ingestion/sourceBackedCohortArtifact.js');
const { rankSeasonPlayers } = require('../dist/src/services/seasonForgeService.js');
const { buildForgePlayerStaticArtifact } = require('../dist/src/services/playerStaticArtifactService.js');

const DEFAULT_SOURCE_BACKED_COHORT_PATH = 'tests/fixtures/artifacts/forge_player_weekly_ppr_2025.cohort.v1.json';
const DEFAULT_OUTPUT_PATH = 'exports/promoted/forge_player_static/forge_player_static_v1.json';

function parseArgs(argv) {
  const options = {
    sourceBackedCohortPath: DEFAULT_SOURCE_BACKED_COHORT_PATH,
    outputPath: DEFAULT_OUTPUT_PATH
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source-backed-cohort') {
      options.sourceBackedCohortPath = argv[++index];
    } else if (arg === '--output') {
      options.outputPath = argv[++index];
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/build-player-static-artifact.js [--source-backed-cohort <path>] [--output <path>]\n\nBuilds a promoted FORGE_PLAYER_STATIC_V1 artifact from a validated source-backed TIBER-Data cohort. The output preserves score_source so downstream consumers can reject fallback/default/baseline rows.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const cohortPath = path.resolve(process.cwd(), options.sourceBackedCohortPath);
  const outputPath = path.resolve(process.cwd(), options.outputPath);
  const ingestion = await ingestSourceBackedCohortArtifact(cohortPath);
  const rankings = rankSeasonPlayers(ingestion.inputs, { artifactPath: cohortPath, cohortMetadata: ingestion.metadata });
  const artifact = buildForgePlayerStaticArtifact(ingestion.inputs, rankings, {
    generatedAt: ingestion.metadata.asOf,
    sourceArtifacts: [options.sourceBackedCohortPath],
    sourceProvider: ingestion.metadata.sourceProvider
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${artifact.artifact_type} (${artifact.row_count} rows) to ${options.outputPath}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = { DEFAULT_OUTPUT_PATH, DEFAULT_SOURCE_BACKED_COHORT_PATH, parseArgs };
