import { adaptForgeWeeklyPlayerInput } from '../adapters/forgeWeeklyPlayerInput';
import { FootballEvaluateRequest, FootballRankingsRequest, NormalizedFootballScoringInput } from '../contracts/football';
import { EvaluateResponse, RankingsResponse, ScoreComponent } from '../contracts/forge';
import { validateEvaluateResponse, validateRankingsResponse } from '../contracts/validation';

const SOURCE_VERSION = '0.3.0';
const FOOTBALL_WARNING =
  'Football lane v1 is deterministic and contract-driven from ForgeWeeklyPlayerInput, but it is not full legacy parity or live ingestion.';

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function confidenceLabel(score: number): EvaluateResponse['confidence']['label'] {
  if (score >= 0.75) {
    return 'high';
  }
  if (score >= 0.45) {
    return 'medium';
  }
  return 'low';
}

function tierForScore(score: number): EvaluateResponse['score']['tier'] {
  if (score >= 82) {
    return 'core';
  }
  if (score >= 68) {
    return 'strong';
  }
  if (score >= 50) {
    return 'neutral';
  }
  return 'avoid';
}

function defenseAdjustment(tier: NormalizedFootballScoringInput['environment']['opponentDefenseTier']): number {
  switch (tier) {
    case 'weak':
      return 8;
    case 'neutral':
      return 2;
    case 'strong':
      return -5;
    case 'elite':
      return -10;
  }
}

function gameScriptAdjustment(script: NormalizedFootballScoringInput['environment']['expectedGameScript'], position: NormalizedFootballScoringInput['position']): number {
  if (position === 'RB') {
    return script === 'positive' ? 6 : script === 'negative' ? -4 : 1;
  }
  if (position === 'QB') {
    return script === 'negative' ? 4 : script === 'positive' ? 1 : 2;
  }
  return script === 'negative' ? 5 : script === 'positive' ? -2 : 2;
}

function injuryPenalty(status: NormalizedFootballScoringInput['injuryStatus']): number {
  switch (status) {
    case 'healthy':
      return 0;
    case 'questionable':
      return 12;
    case 'doubtful':
      return 28;
    case 'out':
      return 45;
  }
}

function buildComponents(input: NormalizedFootballScoringInput): ScoreComponent[] {
  const opportunityRaw =
    input.opportunity.snapShare * 36 +
    input.opportunity.routeParticipation * 22 +
    input.opportunity.rushAttempts * 1.15 +
    input.opportunity.targets * 2.2 +
    input.opportunity.redZoneTouches * 2.6 +
    input.opportunity.goalLineTouches * 3.5;

  const efficiencyRaw =
    input.efficiency.yardsPerRouteRun * 18 +
    input.efficiency.yardsPerCarry * 7 +
    input.efficiency.catchRate * 18 +
    input.efficiency.fantasyPointsPerOpportunity * 24 +
    input.efficiency.explosivePlayRate * 16;

  const environmentRaw =
    input.environment.impliedTeamTotal * 2.1 +
    defenseAdjustment(input.environment.opponentDefenseTier) +
    gameScriptAdjustment(input.environment.expectedGameScript, input.position) +
    clamp(-input.environment.spread * 0.6, -8, 8);

  const stabilityRaw =
    82 -
    injuryPenalty(input.injuryStatus) -
    (input.stability.practiceParticipation === 'limited' ? 10 : 0) -
    (input.stability.practiceParticipation === 'did_not_practice' ? 20 : 0) -
    (input.stability.activeProjection === 'risky' ? 14 : 0) -
    (input.stability.activeProjection === 'expected_inactive' ? 30 : 0) -
    input.stability.roleVolatility * 35 +
    input.stability.featureCoverage * 18;

  return [
    {
      key: 'opportunity',
      label: 'Opportunity',
      weight: 0.38,
      score: round(clamp(opportunityRaw, 0, 100)),
      reason: `Opportunity blends snap share (${round(input.opportunity.snapShare)}), route participation (${round(input.opportunity.routeParticipation)}), rush attempts (${input.opportunity.rushAttempts}), and targets (${input.opportunity.targets}).`
    },
    {
      key: 'efficiency',
      label: 'Efficiency',
      weight: 0.28,
      score: round(clamp(efficiencyRaw, 0, 100)),
      reason: `Efficiency uses YPRR (${round(input.efficiency.yardsPerRouteRun)}), YPC (${round(input.efficiency.yardsPerCarry)}), catch rate (${round(input.efficiency.catchRate)}), and FPO (${round(input.efficiency.fantasyPointsPerOpportunity)}).`
    },
    {
      key: 'environment',
      label: 'Environment',
      weight: 0.18,
      score: round(clamp(environmentRaw, 0, 100)),
      reason: `Environment uses implied total (${round(input.environment.impliedTeamTotal)}), spread (${round(input.environment.spread)}), defense tier (${input.environment.opponentDefenseTier}), and script (${input.environment.expectedGameScript}).`
    },
    {
      key: 'stability',
      label: 'Stability',
      weight: 0.16,
      score: round(clamp(stabilityRaw, 0, 100)),
      reason: `Stability penalizes injury (${input.injuryStatus}), practice (${input.stability.practiceParticipation}), active projection (${input.stability.activeProjection}), and role volatility (${round(input.stability.roleVolatility)}).`
    }
  ];
}

function evaluateInput(request: FootballEvaluateRequest): EvaluateResponse {
  const input = adaptForgeWeeklyPlayerInput(request.input);
  const components = buildComponents(input);
  const overall = round(components.reduce((sum, component) => sum + component.score * component.weight, 0));
  const confidenceScore = round(
    clamp(
      0.2 + input.stability.featureCoverage * 0.34 + input.stability.dataConfidenceHint * 0.26 - input.supportFlags.length * 0.05 - injuryPenalty(input.injuryStatus) / 110,
      0.05,
      0.99
    )
  );

  return validateEvaluateResponse({
    requestId: request.requestId ?? `football-eval-${input.playerId}-${request.context.slateId}`,
    player: {
      playerId: input.playerId,
      playerName: input.playerName,
      team: input.team,
      opponent: input.opponent,
      position: input.position
    },
    score: {
      overall,
      tier: tierForScore(overall),
      rankHint: Math.max(1, 101 - Math.round(overall)),
      components
    },
    confidence: {
      score: confidenceScore,
      label: confidenceLabel(confidenceScore),
      deterministic: true,
      reason: 'Confidence is deterministic from coverage, data-confidence hints, quality flags, and availability status in the football lane.'
    },
    reasons: [
      `${input.playerName} receives a football-lane FORGE score of ${overall}.`,
      `Contract input: ForgeWeeklyPlayerInput/v1 (${input.provenance.sourceSetId}).`,
      'This is the first deterministic football-specific lane, not full legacy parity.'
    ],
    metadata: {
      slateId: request.context.slateId,
      slateDate: request.context.slateDate,
      sport: request.context.sport,
      site: request.context.site,
      contestType: request.context.contestType,
      mode: request.context.mode,
      injuryStatus: input.injuryStatus,
      tags: input.tags,
      bootstrap: false,
      inputContract: 'ForgeWeeklyPlayerInput/v1'
    },
    source: {
      provider: 'tiber-forge-football-lane',
      version: SOURCE_VERSION,
      mode: request.context.mode,
      deterministic: true,
      parityStatus: 'football-lane-v1',
      specAlignment: 'tiber-data-forge-ingestion-v1',
      generatedAt: request.context.slateDate,
      inputContract: 'ForgeWeeklyPlayerInput/v1'
    },
    warnings: [FOOTBALL_WARNING]
  });
}

export function evaluateFootballPlayer(request: FootballEvaluateRequest): EvaluateResponse {
  return evaluateInput(request);
}

export function rankFootballPlayers(request: FootballRankingsRequest): RankingsResponse {
  const requestId = request.requestId ?? `football-rank-${request.context.slateId}`;
  const rankings = request.inputs
    .map((input) =>
      evaluateInput({
        requestId: `${requestId}-${input.playerId}`,
        input,
        context: request.context
      })
    )
    .sort((left, right) => right.score.overall - left.score.overall || left.player.playerId.localeCompare(right.player.playerId))
    .slice(0, request.limit ?? request.inputs.length)
    .map((evaluation, index) => ({
      rank: index + 1,
      ...evaluation,
      reasons:
        request.includeExplanations === false ? ['Explanation output suppressed by includeExplanations=false during football lane mode.'] : evaluation.reasons,
      score: {
        ...evaluation.score,
        components: request.includeExplanations === false ? [] : evaluation.score.components
      }
    }));

  return validateRankingsResponse({
    requestId,
    count: rankings.length,
    rankings,
    metadata: {
      totalCandidates: request.inputs.length,
      returnedCount: rankings.length,
      limitApplied: request.limit ?? null,
      includeExplanations: request.includeExplanations ?? true
    },
    source: {
      provider: 'tiber-forge-football-lane',
      version: SOURCE_VERSION,
      mode: request.context.mode,
      deterministic: true,
      parityStatus: 'football-lane-v1',
      specAlignment: 'tiber-data-forge-ingestion-v1',
      generatedAt: request.context.slateDate,
      inputContract: 'ForgeWeeklyPlayerInput/v1'
    },
    warnings: [
      FOOTBALL_WARNING,
      request.includeExplanations === false ? 'Rankings explanations were intentionally omitted per includeExplanations=false.' : 'Rankings include deterministic football-lane explanations.'
    ]
  });
}
