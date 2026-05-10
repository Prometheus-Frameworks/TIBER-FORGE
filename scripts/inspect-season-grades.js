#!/usr/bin/env node
const path = require('node:path');
const { ingestForgeSeasonArtifact } = require('../dist/src/ingestion/forgeSeasonArtifact.js');
const { rankSeasonPlayers } = require('../dist/src/services/seasonForgeService.js');

function parseArgs(argv) {
  const options = {
    artifactPath: 'tests/fixtures/artifacts/forge_season_player_input_2025.sample.json',
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--artifact-path') {
      options.artifactPath = argv[++index];
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
  console.log(`Usage: node scripts/inspect-season-grades.js [--artifact-path <path>] [--json]\n\nLocal-only 2025 season grading prototype. Reads fixture-backed ForgeSeasonPlayerInput/v1 artifacts only; no live TIBER-Data or projection semantics.`);
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

  const artifactPath = path.resolve(process.cwd(), options.artifactPath);
  const inputs = await ingestForgeSeasonArtifact(artifactPath);
  const result = rankSeasonPlayers(inputs);

  if (options.json) {
    console.log(JSON.stringify({ artifactPath, ...result }, null, 2));
    return;
  }

  console.log('FORGE local-only 2025 retrospective season grades');
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

module.exports = { parseArgs, printable };
