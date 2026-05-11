#!/usr/bin/env node
const path = require('node:path');
const { ingestForgeSeasonArtifact } = require('../dist/src/ingestion/forgeSeasonArtifact.js');
const { ingestSourceBackedCohortArtifact } = require('../dist/src/ingestion/sourceBackedCohortArtifact.js');
const { rankSeasonPlayers } = require('../dist/src/services/seasonForgeService.js');

const DEFAULT_ARTIFACT_PATH = 'tests/fixtures/artifacts/forge_season_player_input_2025.sample.json';
const REAL_PLAYERS_ARTIFACT_PATH = 'tests/fixtures/artifacts/forge_season_player_input_2025.real_players_sample.json';

function parseArgs(argv) {
  const options = {
    artifactPath: DEFAULT_ARTIFACT_PATH,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--artifact-path') {
      options.artifactPath = argv[++index];
    } else if (arg === '--source-backed-cohort') {
      options.sourceBackedCohortPath = argv[++index];
    } else if (arg === '--real-players') {
      options.artifactPath = REAL_PLAYERS_ARTIFACT_PATH;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/inspect-season-grades.js [--artifact-path <path>] [--real-players] [--source-backed-cohort <path>] [--json]\n\nRetrospective 2025 season grading inspector. Fixture calibration artifacts remain supported by --artifact-path and --real-players. Use --source-backed-cohort to ingest a validated TIBER-Data forge_player_weekly_ppr_2025.cohort.v1.json artifact. No projection semantics are applied.`);
}

function printable(rankingsResult, artifactPath) {
  return rankingsResult.rankings.map((entry) => ({
    rank: entry.rank,
    player: entry.player.playerName,
    playerId: entry.player.playerId,
    position: entry.player.position,
    team: entry.player.team,
    score: entry.score,
    tier: entry.tier,
    components: Object.fromEntries(entry.components.map((component) => [component.key, component.score])),
    confidence: `${entry.confidence.label} (${entry.confidence.score})`,
    warnings: entry.warnings
  })).map((entry) => ({ artifactPath, ...entry }));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const sourceBacked = Boolean(options.sourceBackedCohortPath);
  const artifactPath = path.resolve(process.cwd(), sourceBacked ? options.sourceBackedCohortPath : options.artifactPath);
  const ingestion = sourceBacked ? await ingestSourceBackedCohortArtifact(artifactPath) : { inputs: await ingestForgeSeasonArtifact(artifactPath), metadata: undefined };
  const result = rankSeasonPlayers(ingestion.inputs, sourceBacked ? { artifactPath, cohortMetadata: ingestion.metadata } : {});

  if (options.json) {
    console.log(JSON.stringify({ inspectionMode: sourceBacked ? 'source-backed-cohort' : 'fixture', artifactPath, ...result }, null, 2));
    return;
  }

  console.log(sourceBacked ? 'FORGE source-backed TIBER-Data retrospective season grades' : 'FORGE local-only 2025 retrospective season grades');
  if (sourceBacked) {
    console.log(`Cohort artifact path: ${artifactPath}`);
    console.log(`Cohort buildId: ${ingestion.metadata.buildId}`);
    console.log(`Source provider: ${ingestion.metadata.sourceProvider}`);
    console.log(`Player count: ${result.count}`);
    console.log(`Season: ${result.season}`);
  }
  console.log('Warnings:');
  for (const warning of result.warnings) {
    console.log(`- ${warning}`);
  }
  console.table(printable(result, artifactPath));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = { DEFAULT_ARTIFACT_PATH, REAL_PLAYERS_ARTIFACT_PATH, parseArgs, printable };
