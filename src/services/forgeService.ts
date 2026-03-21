import { EvaluateRequest, EvaluateResponse, PlayerInput, RankingsRequest, RankingsResponse, ScoreComponent } from '../contracts/forge';
import { validateEvaluateResponse, validateRankingsResponse } from '../contracts/validation';

const SOURCE_VERSION = '0.2.0';
const BOOTSTRAP_WARNING = 'Bootstrap scaffold only; fields align to the PR72 transition contract, but legacy FORGE parity remains intentionally deferred.';

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function availabilityScore(status: PlayerInput['injuryStatus']): number {
  switch (status) {
    case 'healthy':
      return 95;
    case 'questionable':
      return 68;
    case 'doubtful':
      return 35;
    case 'out':
      return 0;
  }
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

function buildSource(generatedAt: string): EvaluateResponse['source'] {
  return {
    provider: 'tiber-forge-bootstrap',
    version: SOURCE_VERSION,
    mode: 'bootstrap-demo',
    deterministic: true,
    parityStatus: 'bootstrap-scaffold',
    specAlignment: 'pr72-transition',
    generatedAt
  };
}

function buildComponents(player: PlayerInput): ScoreComponent[] {
  const projectedMinutes = player.projectedMinutes ?? 24;
  const recentFantasyPoints = player.recentFantasyPoints ?? 20;
  const salary = player.salary ?? 7000;
  const availability = availabilityScore(player.injuryStatus);

  const opportunity = Math.min(100, round(30 + projectedMinutes * 1.8));
  const recentForm = Math.min(100, round(20 + recentFantasyPoints * 2.1));
  const salaryEfficiency = Math.min(100, round((recentFantasyPoints / Math.max(salary, 1)) * 12000));

  return [
    {
      key: 'opportunity',
      label: 'Opportunity',
      weight: 0.35,
      score: opportunity,
      reason: `Projected minutes (${projectedMinutes}) drive the deterministic bootstrap opportunity component.`
    },
    {
      key: 'recent_form',
      label: 'Recent Form',
      weight: 0.3,
      score: recentForm,
      reason: `Recent fantasy points (${recentFantasyPoints}) feed the deterministic recent-form component.`
    },
    {
      key: 'salary_efficiency',
      label: 'Salary Efficiency',
      weight: 0.2,
      score: salaryEfficiency,
      reason: `Salary (${salary}) is compared with recent production to estimate placeholder value efficiency.`
    },
    {
      key: 'availability',
      label: 'Availability',
      weight: 0.15,
      score: availability,
      reason: `Injury status (${player.injuryStatus}) applies a deterministic availability adjustment.`
    }
  ];
}

function scorePlayer(player: PlayerInput, request: EvaluateRequest): EvaluateResponse {
  const generatedAt = request.context.slateDate;
  const projectedMinutes = player.projectedMinutes ?? 24;
  const availability = availabilityScore(player.injuryStatus);
  const components = buildComponents(player);
  const overall = round(components.reduce((sum, component) => sum + component.score * component.weight, 0));
  const confidenceScore = round(
    Math.min(1, 0.35 + availability / 400 + Math.min(projectedMinutes, 36) / 100 + (player.tags.length > 0 ? 0.05 : 0))
  );
  const primaryComponent = components.slice().sort((left, right) => right.score - left.score)[0];

  return validateEvaluateResponse({
    requestId: request.requestId ?? `eval-${player.playerId}-${request.context.slateId}`,
    player: {
      playerId: player.playerId,
      playerName: player.playerName,
      team: player.team,
      opponent: player.opponent,
      position: player.position,
      salary: player.salary
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
      reason: 'Confidence is a deterministic bootstrap heuristic derived from availability, projected minutes, and simple tag presence.'
    },
    reasons: [
      `${player.playerName} receives a bootstrap FORGE score of ${overall}.`,
      'This service currently returns a transition-aligned scaffold rather than full legacy FORGE parity.',
      `Top component driver: ${primaryComponent.key}.`
    ],
    metadata: {
      slateId: request.context.slateId,
      slateDate: request.context.slateDate,
      sport: request.context.sport,
      site: request.context.site,
      contestType: request.context.contestType,
      mode: request.context.mode,
      injuryStatus: player.injuryStatus,
      tags: player.tags,
      bootstrap: true
    },
    source: buildSource(generatedAt),
    warnings: [BOOTSTRAP_WARNING]
  });
}

export function evaluatePlayer(request: EvaluateRequest): EvaluateResponse {
  return scorePlayer(request.player, request);
}

export function rankPlayers(request: RankingsRequest): RankingsResponse {
  const requestId = request.requestId ?? `rank-${request.context.slateId}`;
  const limitApplied = request.limit ?? null;
  const rankings = request.players
    .map((player) =>
      scorePlayer(player, {
        requestId: `${requestId}-${player.playerId}`,
        player,
        context: request.context
      })
    )
    .sort((left, right) => right.score.overall - left.score.overall || left.player.playerId.localeCompare(right.player.playerId))
    .slice(0, request.limit ?? request.players.length)
    .map((evaluation, index) => ({
      rank: index + 1,
      ...evaluation,
      reasons: request.includeExplanations === false ? ['Explanation output suppressed by includeExplanations=false during bootstrap mode.'] : evaluation.reasons,
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
      totalCandidates: request.players.length,
      returnedCount: rankings.length,
      limitApplied,
      includeExplanations: request.includeExplanations ?? true
    },
    source: buildSource(request.context.slateDate),
    warnings: [
      BOOTSTRAP_WARNING,
      request.includeExplanations === false ? 'Rankings explanations were intentionally omitted per includeExplanations=false.' : 'Rankings include deterministic bootstrap explanations.'
    ]
  });
}
