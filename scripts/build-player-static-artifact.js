#!/usr/bin/env node
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { ingestSourceBackedCohortArtifact } = require('../dist/src/ingestion/sourceBackedCohortArtifact.js');
const { ingestForgeSeasonArtifact } = require('../dist/src/ingestion/forgeSeasonArtifact.js');
const { rankSeasonPlayers } = require('../dist/src/services/seasonForgeService.js');
const { buildForgePlayerStaticArtifact } = require('../dist/src/services/playerStaticArtifactService.js');

const DEFAULT_SOURCE_BACKED_COHORT_PATH = 'tests/fixtures/artifacts/forge_player_weekly_ppr_2025.cohort.v1.json';
const DEFAULT_GENERATED_BASELINE_SEASON_PATHS = ['tests/fixtures/artifacts/forge_season_player_input_2025.real_players_sample.json'];
const DEFAULT_OUTPUT_PATH = 'exports/promoted/forge_player_static/forge_player_static_v1.json';

function parseArgs(argv) {
  const options = {
    sourceBackedCohortPath: DEFAULT_SOURCE_BACKED_COHORT_PATH,
    generatedBaselineSeasonPaths: [...DEFAULT_GENERATED_BASELINE_SEASON_PATHS],
    outputPath: DEFAULT_OUTPUT_PATH
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source-backed-cohort') {
      options.sourceBackedCohortPath = argv[++index];
    } else if (arg === '--generated-baseline-season') {
      options.generatedBaselineSeasonPaths.push(argv[++index]);
    } else if (arg === '--no-generated-baselines') {
      options.generatedBaselineSeasonPaths = [];
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
  console.log(`Usage: node scripts/build-player-static-artifact.js [--source-backed-cohort <path>] [--generated-baseline-season <path>] [--no-generated-baselines] [--output <path>]\n\nBuilds a promoted FORGE_PLAYER_STATIC_V1 artifact from a validated source-backed TIBER-Data cohort plus explicit generated-baseline season inputs. The output preserves score_source so downstream consumers can reject fallback/default/baseline rows.`);
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
  const generatedBaselineInputs = (await Promise.all(
    options.generatedBaselineSeasonPaths.map((baselinePath) => ingestForgeSeasonArtifact(path.resolve(process.cwd(), baselinePath)))
  )).flat();
  const inputs = [...ingestion.inputs, ...generatedBaselineInputs];
  const rankings = rankSeasonPlayers(inputs);
  const artifact = buildForgePlayerStaticArtifact(inputs, rankings, {
    generatedAt: ingestion.metadata.asOf,
    sourceArtifacts: [options.sourceBackedCohortPath, ...options.generatedBaselineSeasonPaths]
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

module.exports = { DEFAULT_GENERATED_BASELINE_SEASON_PATHS, DEFAULT_OUTPUT_PATH, DEFAULT_SOURCE_BACKED_COHORT_PATH, parseArgs };
