import { EvaluateRequest, EvaluateResponse, PlayerInput, RankingsRequest, RankingsResponse, ScoreComponent } from '../contracts/forge';
import { validateEvaluateResponse, validateRankingsResponse } from '../contracts/validation';

const SOURCE_VERSION = '0.2.0';
const BOOTSTRAP_WARNING = 'Bootstrap scaffold only; fields align to the PR72 transition contract, but legacy FORGE parity remains intentionally deferred.';

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function availabilityScore(status: PlayerInput['injuryStatus']): number {
  switch (status) {
    case 'healthy':
      return 96;
    case 'questionable':
      return 62;
    case 'doubtful':
      return 8;
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

  const weakOpportunityPenalty = projectedMinutes < 20 ? (20 - projectedMinutes) * 2.5 : 0;
  const opportunity = round(clamp(18 + projectedMinutes * 2 - weakOpportunityPenalty, 0, 100));
  const recentForm = round(clamp(15 + recentFantasyPoints * 1.9, 0, 100));
  const fantasyPointsPerThousand = recentFantasyPoints / Math.max(salary / 1000, 1);
  const salaryEfficiency = round(clamp(20 + fantasyPointsPerThousand * 12, 0, 100));

  return [
    {
      key: 'opportunity',
      label: 'Opportunity',
      weight: 0.4,
      score: opportunity,
      reason:
        projectedMinutes < 20
          ? `Projected minutes (${projectedMinutes}) fall into a weak-opportunity range, so the deterministic bootstrap logic applies an extra minutes penalty.`
          : `Projected minutes (${projectedMinutes}) anchor the deterministic bootstrap opportunity component.`
    },
    {
      key: 'recent_form',
      label: 'Recent Form',
      weight: 0.26,
      score: recentForm,
      reason: `Recent fantasy points (${recentFantasyPoints}) feed the deterministic recent-form component with a capped, repeatable scaling curve.`
    },
    {
      key: 'salary_efficiency',
      label: 'Salary Efficiency',
      weight: 0.08,
      score: salaryEfficiency,
      reason: `Salary (${salary}) is compared with recent production to estimate placeholder value efficiency without changing the response contract.`
    },
    {
      key: 'availability',
      label: 'Availability',
      weight: 0.26,
      score: availability,
      reason:
        player.injuryStatus === 'healthy'
          ? 'Healthy status preserves a strong deterministic availability component.'
          : `Injury status (${player.injuryStatus}) applies a stronger deterministic availability penalty in bootstrap parity mode.`
    }
  ];
}

function scorePlayer(player: PlayerInput, request: EvaluateRequest): EvaluateResponse {
  const generatedAt = request.context.slateDate;
  const projectedMinutes = player.projectedMinutes ?? 24;
  const recentFantasyPoints = player.recentFantasyPoints ?? 20;
  const availability = availabilityScore(player.injuryStatus);
  const components = buildComponents(player);
  const overall = round(components.reduce((sum, component) => sum + component.score * component.weight, 0));
  const fragilityPenalty =
    (player.injuryStatus === 'questionable' ? 0.12 : 0) +
    (player.injuryStatus === 'doubtful' ? 0.24 : 0) +
    (player.injuryStatus === 'out' ? 0.5 : 0) +
    (projectedMinutes < 20 ? 0.08 : 0);
  const confidenceScore = round(
    clamp(0.18 + availability / 260 + Math.min(projectedMinutes, 36) / 110 + Math.min(recentFantasyPoints, 45) / 220 + (player.tags.length > 0 ? 0.03 : 0) - fragilityPenalty, 0.05, 0.99)
  );
  const primaryComponent = components
    .slice()
    .sort((left, right) => right.score * right.weight - left.score * left.weight || left.key.localeCompare(right.key))[0];

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
      reason:
        'Confidence is a deterministic bootstrap heuristic derived from availability, projected minutes, recent form, and explicit fragility penalties; it remains scaffold logic rather than full legacy parity.'
    },
    reasons: [
      `${player.playerName} receives a bootstrap FORGE score of ${overall}.`,
      'This service still returns a transition-aligned scaffold rather than full legacy FORGE parity.',
      `Top weighted component driver: ${primaryComponent.key}.`
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
