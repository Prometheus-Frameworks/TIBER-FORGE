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
  if (score >= 0.72) {
    return 'high';
  }
  if (score >= 0.38) {
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
      return 10;
    case 'neutral':
      return 2;
    case 'strong':
      return -6;
    case 'elite':
      return -12;
  }
}

function gameScriptAdjustment(script: NormalizedFootballScoringInput['environment']['expectedGameScript'], position: NormalizedFootballScoringInput['position']): number {
  if (position === 'RB') {
    return script === 'positive' ? 6 : script === 'negative' ? -4 : 1;
  }
  if (position === 'QB') {
    return script === 'negative' ? 4 : script === 'positive' ? 0 : 2;
  }
  return script === 'negative' ? 4 : script === 'positive' ? -2 : 1;
}

function spreadAdjustment(spread: number, position: NormalizedFootballScoringInput['position']): number {
  if (position === 'RB') {
    return clamp(-spread * 0.8, -10, 10);
  }
  if (position === 'QB') {
    return clamp(-spread * 0.6, -8, 8);
  }
  return clamp(-spread * 0.5, -7, 7);
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

function opportunityScore(input: NormalizedFootballScoringInput): number {
  if (input.position === 'QB') {
    return (
      input.opportunity.snapShare * 48 +
      input.opportunity.routeParticipation * 4 +
      input.opportunity.rushAttempts * 1.6 +
      input.opportunity.targets * 0.4 +
      input.opportunity.redZoneTouches * 1.3 +
      input.opportunity.goalLineTouches * 4
    );
  }

  if (input.position === 'RB') {
    return (
      input.opportunity.snapShare * 34 +
      input.opportunity.routeParticipation * 16 +
      input.opportunity.rushAttempts * 1.6 +
      input.opportunity.targets * 2 +
      input.opportunity.redZoneTouches * 2.4 +
      input.opportunity.goalLineTouches * 3.6
    );
  }

  return (
    input.opportunity.snapShare * 30 +
    input.opportunity.routeParticipation * 30 +
    input.opportunity.rushAttempts * 0.35 +
    input.opportunity.targets * 2.8 +
    input.opportunity.redZoneTouches * 2.5 +
    input.opportunity.goalLineTouches * 1.8
  );
}

function efficiencyScore(input: NormalizedFootballScoringInput): number {
  if (input.position === 'QB') {
    return (
      input.efficiency.yardsPerRouteRun * 4 +
      input.efficiency.yardsPerCarry * 9 +
      input.efficiency.catchRate * 4 +
      input.efficiency.fantasyPointsPerOpportunity * 30 +
      input.efficiency.explosivePlayRate * 22
    );
  }

  if (input.position === 'RB') {
    return (
      input.efficiency.yardsPerRouteRun * 6 +
      input.efficiency.yardsPerCarry * 11 +
      input.efficiency.catchRate * 6 +
      input.efficiency.fantasyPointsPerOpportunity * 28 +
      input.efficiency.explosivePlayRate * 18
    );
  }

  return (
    input.efficiency.yardsPerRouteRun * 22 +
    input.efficiency.yardsPerCarry * 2 +
    input.efficiency.catchRate * 14 +
    input.efficiency.fantasyPointsPerOpportunity * 30 +
    input.efficiency.explosivePlayRate * 20
  );
}

function buildComponents(input: NormalizedFootballScoringInput): ScoreComponent[] {
  const opportunityRaw = opportunityScore(input);
  const efficiencyRaw = efficiencyScore(input);

  const environmentRaw =
    input.environment.impliedTeamTotal * 1.85 +
    defenseAdjustment(input.environment.opponentDefenseTier) +
    gameScriptAdjustment(input.environment.expectedGameScript, input.position) +
    spreadAdjustment(input.environment.spread, input.position);

  const stabilityRaw =
    80 -
    injuryPenalty(input.injuryStatus) -
    (input.stability.practiceParticipation === 'limited' ? 8 : 0) -
    (input.stability.practiceParticipation === 'did_not_practice' ? 18 : 0) -
    (input.stability.activeProjection === 'risky' ? 16 : 0) -
    (input.stability.activeProjection === 'expected_inactive' ? 32 : 0) -
    input.stability.roleVolatility * 36 +
    input.stability.featureCoverage * 12 -
    clamp(input.supportFlags.length * 1.5, 0, 6) +
    input.stability.dataConfidenceHint * 6;

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
  const practiceConfidencePenalty =
    input.stability.practiceParticipation === 'did_not_practice' ? 0.07 : input.stability.practiceParticipation === 'limited' ? 0.03 : 0;
  const projectionConfidencePenalty =
    input.stability.activeProjection === 'expected_inactive' ? 0.12 : input.stability.activeProjection === 'risky' ? 0.05 : 0;
  const activeProjectionConfidenceAdjustment =
    input.stability.activeProjection === 'expected_active' ? 0.05 : input.stability.activeProjection === 'risky' ? -0.02 : -0.08;
  const confidenceScore = round(
    clamp(
      0.2 +
        input.stability.featureCoverage * 0.36 +
        input.stability.dataConfidenceHint * 0.28 +
        activeProjectionConfidenceAdjustment -
        clamp(input.supportFlags.length * 0.035, 0, 0.14) -
        injuryPenalty(input.injuryStatus) / 130 -
        input.stability.roleVolatility * 0.18 -
        practiceConfidencePenalty -
        projectionConfidencePenalty,
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
