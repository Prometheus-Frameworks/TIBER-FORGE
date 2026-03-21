import { EvaluateRequest, EvaluateResponse, PlayerInput, RankingsRequest, RankingsResponse } from '../contracts/forge';
import { validateEvaluateResponse, validateRankingsResponse } from '../contracts/validation';

const SOURCE_VERSION = '0.1.0';

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

function tierForScore(score: number): EvaluateResponse['tier'] {
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
    generatedAt
  };
}

function scorePlayer(player: PlayerInput, generatedAt: string): Omit<EvaluateResponse, 'requestId'> {
  const projectedMinutes = player.projectedMinutes ?? 24;
  const recentFantasyPoints = player.recentFantasyPoints ?? 20;
  const salary = player.salary ?? 7000;

  const opportunity = Math.min(100, round(30 + projectedMinutes * 1.8));
  const recentForm = Math.min(100, round(20 + recentFantasyPoints * 2.1));
  const salaryEfficiency = Math.min(100, round((recentFantasyPoints / Math.max(salary, 1)) * 12000));
  const availability = availabilityScore(player.injuryStatus);

  const components: EvaluateResponse['components'] = [
    {
      name: 'opportunity',
      weight: 0.35,
      score: opportunity,
      reason: `Projected minutes (${projectedMinutes}) drive bootstrap opportunity scoring.`
    },
    {
      name: 'recent-form',
      weight: 0.3,
      score: recentForm,
      reason: `Recent fantasy points (${recentFantasyPoints}) feed the deterministic recent-form component.`
    },
    {
      name: 'salary-efficiency',
      weight: 0.2,
      score: salaryEfficiency,
      reason: `Salary (${salary}) is compared with recent production to estimate placeholder value efficiency.`
    },
    {
      name: 'availability',
      weight: 0.15,
      score: availability,
      reason: `Injury status (${player.injuryStatus}) applies a deterministic availability adjustment.`
    }
  ];

  const score = round(components.reduce((sum, component) => sum + component.score * component.weight, 0));
  const confidence = round(
    Math.min(1, 0.35 + availability / 400 + Math.min(projectedMinutes, 36) / 100 + (player.tags.length > 0 ? 0.05 : 0))
  );

  return {
    playerId: player.playerId,
    score,
    tier: tierForScore(score),
    rankingHint: Math.max(1, 101 - Math.round(score)),
    components,
    confidence: {
      score: confidence,
      label: confidenceLabel(confidence)
    },
    reasons: [
      `${player.playerName} receives a bootstrap FORGE score of ${score}.`,
      'This service currently uses deterministic placeholder heuristics, not legacy FORGE parity logic.',
      `Top driver: ${components.slice().sort((a, b) => b.score - a.score)[0].name}.`
    ],
    source: buildSource(generatedAt),
    warnings: ['Bootstrap/demo scoring only; legacy FORGE parity is intentionally deferred.']
  };
}

export function evaluatePlayer(request: EvaluateRequest): EvaluateResponse {
  const requestId = request.requestId ?? `eval-${request.player.playerId}-${request.context.slateId}`;
  const generatedAt = request.context.slateDate;
  return validateEvaluateResponse({
    requestId,
    ...scorePlayer(request.player, generatedAt)
  });
}

export function rankPlayers(request: RankingsRequest): RankingsResponse {
  const requestId = request.requestId ?? `rank-${request.context.slateId}`;
  const generatedAt = request.context.slateDate;
  const evaluations = request.players.map((player) =>
    evaluatePlayer({
      requestId: `${requestId}-${player.playerId}`,
      player,
      context: request.context
    })
  );

  const rankings = evaluations
    .sort((left, right) => right.score - left.score || left.playerId.localeCompare(right.playerId))
    .slice(0, request.limit ?? evaluations.length)
    .map((evaluation, index) => ({ rank: index + 1, evaluation }));

  return validateRankingsResponse({
    requestId,
    count: rankings.length,
    rankings,
    source: buildSource(generatedAt),
    warnings: ['Rankings are bootstrap/demo outputs and intentionally do not represent full legacy FORGE parity.']
  });
}
