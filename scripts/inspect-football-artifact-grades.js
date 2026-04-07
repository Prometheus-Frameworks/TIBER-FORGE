#!/usr/bin/env node
const path = require('node:path');
const { ingestForgeWeeklyArtifact } = require('../dist/src/ingestion/forgeWeeklyArtifact.js');
const { rankFootballPlayers } = require('../dist/src/services/footballForgeService.js');

function parseArgs(argv) {
  const options = {
    artifactKind: 'derived_skill',
    week: 1,
    season: 2024,
    limit: 5,
    artifactPath: undefined,
    artifactTemplate: undefined,
    useRealTiberData: false,
    includeExplanations: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--artifact-kind' && next) {
      options.artifactKind = next;
      i += 1;
      continue;
    }
    if (arg === '--week' && next) {
      options.week = Number(next);
      i += 1;
      continue;
    }
    if (arg === '--season' && next) {
      options.season = Number(next);
      i += 1;
      continue;
    }
    if (arg === '--limit' && next) {
      options.limit = Number(next);
      i += 1;
      continue;
    }
    if (arg === '--artifact-path' && next) {
      options.artifactPath = next;
      i += 1;
      continue;
    }
    if (arg === '--artifact-template' && next) {
      options.artifactTemplate = next;
      i += 1;
      continue;
    }
    if (arg === '--use-real-tiber-data') {
      options.useRealTiberData = true;
      continue;
    }
    if (arg === '--compact') {
      options.includeExplanations = false;
    }
  }

  return options;
}

function artifactPathForRequest(options) {
  if (options.artifactPath) {
    return path.resolve(process.cwd(), options.artifactPath);
  }

  const realDerivedSkillTemplate =
    '../TIBER-Data/data/gold/forge/forge_weekly_player_input_{season}_w{week}.skill_positions_season_segment.derived.json';

  const samplePath = process.env.FORGE_WEEKLY_INPUT_ARTIFACT_PATH ?? '../TIBER-Data/data/gold/forge/forge_weekly_player_input_2025_w12.sample.json';
  const derivedQbPath =
    process.env.FORGE_WEEKLY_DERIVED_QB_ARTIFACT_PATH ?? '../TIBER-Data/data/gold/forge/forge_weekly_player_input_2024_w01.qb_offline_fixture.derived.json';
  const derivedSkillPath =
    process.env.FORGE_WEEKLY_DERIVED_SKILL_ARTIFACT_PATH ?? '../TIBER-Data/data/gold/forge/forge_weekly_player_input_2024_w01.skill_positions_offline_fixture.derived.json';
  const envDerivedSkillTemplate = process.env.FORGE_WEEKLY_DERIVED_SKILL_ARTIFACT_PATH_TEMPLATE;

  if (options.artifactKind === 'derived_skill' && options.artifactTemplate) {
    const week = String(options.week).padStart(2, '0');
    const templatedPath = options.artifactTemplate.replaceAll('{week}', week).replaceAll('{season}', String(options.season));
    return path.resolve(process.cwd(), templatedPath);
  }

  if (options.artifactKind === 'derived_skill' && options.useRealTiberData) {
    const week = String(options.week).padStart(2, '0');
    const templatedPath = realDerivedSkillTemplate.replaceAll('{week}', week).replaceAll('{season}', String(options.season));
    return path.resolve(process.cwd(), templatedPath);
  }

  if (options.artifactKind === 'derived_skill' && envDerivedSkillTemplate && !options.useRealTiberData) {
    const week = String(options.week).padStart(2, '0');
    const templatedPath = envDerivedSkillTemplate.replaceAll('{week}', week).replaceAll('{season}', String(options.season));
    return path.resolve(process.cwd(), templatedPath);
  }

  if (options.artifactKind === 'sample') {
    return path.resolve(process.cwd(), samplePath);
  }
  if (options.artifactKind === 'derived_qb') {
    return path.resolve(process.cwd(), derivedQbPath);
  }
  return path.resolve(process.cwd(), derivedSkillPath);
}

function defaultContext(records, artifactKind) {
  const first = records[0];
  const site = artifactKind === 'sample' ? 'artifact-sample' : artifactKind === 'derived_qb' ? 'artifact-derived-qb' : 'artifact-derived-skill';
  return {
    slateId: `nfl-${first.season}-w${first.week}-artifact-debug`,
    slateDate: first.asOf,
    sport: 'nfl',
    site,
    contestType: 'simulation',
    mode: 'bootstrap-demo'
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const artifactPath = artifactPathForRequest(options);
  const inputs = await ingestForgeWeeklyArtifact(artifactPath);
  const context = defaultContext(inputs, options.artifactKind);

  const result = rankFootballPlayers({
    requestId: `artifact-debug-${options.artifactKind}-${options.season}-w${options.week}`,
    context,
    inputs,
    limit: options.limit,
    includeExplanations: options.includeExplanations
  });

  const preview = result.rankings.map((entry) => ({
    rank: entry.rank,
    playerId: entry.player.playerId,
    playerName: entry.player.playerName,
    position: entry.player.position,
    overall: entry.score.overall,
    tier: entry.score.tier,
    confidenceScore: entry.confidence.score,
    confidenceLabel: entry.confidence.label,
    components: Object.fromEntries(entry.score.components.map((component) => [component.key, component.score])),
    lane: options.artifactKind,
    artifactWeek: inputs[0]?.week,
    sourceSetId: inputs.find((row) => row.playerId === entry.player.playerId)?.sourceSetId
  }));

  console.log(JSON.stringify({ artifactPath, totalCandidates: inputs.length, returned: preview.length, preview }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
