import { ForgeSeasonComponentGrade, ForgeSeasonPlayerGrade, ForgeSeasonPlayerInputV1, ForgeSeasonRankingsResult } from '../contracts/football';

const SEASON_WARNINGS = [
  'Fixture-backed local 2025 season prototype: inspect-only sample semantics.',
  'Not live TIBER-Data; this service reads only the artifact supplied by the operator.',
  'Retrospective realized-season grading only; no projection semantics are implied.'
];

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function opportunityCount(input: ForgeSeasonPlayerInputV1): number {
  if (input.position === 'QB') {
    return (input.passingAttempts ?? 0) + (input.carries ?? 0);
  }
  return (input.carries ?? 0) + (input.targets ?? 0);
}

function realizedPprBenchmark(input: ForgeSeasonPlayerInputV1): number {
  return input.position === 'QB' ? 405 : input.position === 'RB' ? 360 : input.position === 'WR' ? 350 : 275;
}

function volumeBenchmark(input: ForgeSeasonPlayerInputV1): number {
  return input.position === 'QB' ? 690 : input.position === 'RB' ? 390 : input.position === 'WR' ? 185 : 150;
}

function efficiencyBenchmark(input: ForgeSeasonPlayerInputV1): number {
  return input.position === 'QB' ? 0.68 : input.position === 'RB' ? 0.92 : input.position === 'WR' ? 1.85 : 1.55;
}

function tierForScore(score: number): ForgeSeasonPlayerGrade['tier'] {
  if (score >= 85) {
    return 'elite';
  }
  if (score >= 75) {
    return 'high';
  }
  if (score >= 62) {
    return 'solid';
  }
  if (score >= 50) {
    return 'volatile';
  }
  return 'low';
}

function confidenceLabel(score: number): ForgeSeasonPlayerGrade['confidence']['label'] {
  if (score >= 0.75) {
    return 'high';
  }
  if (score >= 0.45) {
    return 'medium';
  }
  return 'low';
}

function buildWarnings(input: ForgeSeasonPlayerInputV1, fragilityScore: number, opportunities: number): string[] {
  const warnings = [...SEASON_WARNINGS];
  if (fragilityScore < 60) {
    warnings.push('Fragility penalty: touchdown concentration is high relative to volume and realized PPR.');
  }
  if (opportunities < volumeBenchmark(input) * 0.45) {
    warnings.push('Low-volume sample: efficiency is not allowed to outrank elite realized volume by itself.');
  }
  for (const flag of input.qualityFlags ?? []) {
    warnings.push(`Fixture quality flag: ${flag}.`);
  }
  return warnings;
}

function buildComponents(input: ForgeSeasonPlayerInputV1): ForgeSeasonComponentGrade[] {
  const opportunities = opportunityCount(input);
  const pointsPerOpportunity = opportunities > 0 ? input.pprPoints / opportunities : 0;
  const tdPerGame = input.games > 0 ? input.totalTd / input.games : 0;
  const touchdownFantasyPoints = input.position === 'QB' ? (input.passingTd ?? 0) * 4 + (input.rushingTd ?? 0) * 6 : input.totalTd * 6;
  const tdShare = input.pprPoints > 0 ? touchdownFantasyPoints / input.pprPoints : 0;
  const lowVolumePenalty = opportunities < volumeBenchmark(input) * 0.45 ? 12 : 0;
  const tdShareThreshold = input.position === 'QB' ? 0.5 : 0.24;
  const tdSpikePenalty = clamp((tdShare - tdShareThreshold) * 200 + (tdPerGame - 0.75) * 28, 0, 50);

  return [
    {
      key: 'realized_ppr',
      label: 'Realized PPR',
      weight: 0.35,
      score: round(clamp((input.pprPoints / realizedPprBenchmark(input)) * 100, 0, 100)),
      reason: `Uses actual fixture PPR (${input.pprPoints}) against a simple ${input.position} season benchmark (${realizedPprBenchmark(input)}).`
    },
    {
      key: 'volume',
      label: 'Volume',
      weight: 0.25,
      score: round(clamp((opportunities / volumeBenchmark(input)) * 100, 0, 100)),
      reason: `Uses recorded retrospective opportunities (${opportunities}) against a simple ${input.position} volume benchmark (${volumeBenchmark(input)}).`
    },
    {
      key: 'efficiency',
      label: 'Efficiency',
      weight: 0.15,
      score: round(clamp((pointsPerOpportunity / efficiencyBenchmark(input)) * 100 - lowVolumePenalty, 0, 100)),
      reason: `Uses PPR per opportunity (${round(pointsPerOpportunity)}) with an explicit low-volume guard (${lowVolumePenalty} points).`
    },
    {
      key: 'availability',
      label: 'Availability',
      weight: 0.15,
      score: round(clamp((input.games / 17) * 100, 0, 100)),
      reason: `Uses games played (${input.games}) out of a 17-game season.`
    },
    {
      key: 'fragility',
      label: 'Fragility',
      weight: 0.1,
      score: round(clamp(100 - tdSpikePenalty - lowVolumePenalty, 0, 100)),
      reason: `Starts at 100 and applies touchdown concentration (${round(tdShare * 100)}% of PPR), TD/game (${round(tdPerGame)}), and low-volume penalties.`
    }
  ];
}

export function gradeSeasonPlayer(input: ForgeSeasonPlayerInputV1): ForgeSeasonPlayerGrade {
  const components = buildComponents(input);
  const score = round(components.reduce((sum, component) => sum + component.score * component.weight, 0));
  const fragilityScore = components.find((component) => component.key === 'fragility')?.score ?? 100;
  const opportunities = opportunityCount(input);
  const confidenceScore = round(clamp(0.22 + input.featureCoverage * 0.45 + (input.games / 17) * 0.28 - (input.qualityFlags?.length ?? 0) * 0.04, 0.05, 0.99));

  return {
    player: {
      playerId: input.playerId,
      playerName: input.playerName,
      position: input.position,
      team: input.team
    },
    score,
    tier: tierForScore(score),
    components,
    confidence: {
      score: confidenceScore,
      label: confidenceLabel(confidenceScore),
      deterministic: true,
      reason: 'Confidence is deterministic from fixture feature coverage, games played, and explicit quality flags.'
    },
    warnings: buildWarnings(input, fragilityScore, opportunities)
  };
}

export function rankSeasonPlayers(inputs: ForgeSeasonPlayerInputV1[]): ForgeSeasonRankingsResult {
  const rankings = inputs
    .map(gradeSeasonPlayer)
    .sort((left, right) => right.score - left.score || left.player.playerId.localeCompare(right.player.playerId))
    .map((grade, index) => ({ ...grade, rank: index + 1 }));

  return {
    season: 2025,
    sourceSetId: inputs[0]?.sourceSetId ?? 'unknown-season-fixture',
    count: rankings.length,
    rankings,
    warnings: SEASON_WARNINGS
  };
}

export const seasonPrototypeWarnings = SEASON_WARNINGS;
