import { ForgeWeeklyPlayerInput, NormalizedFootballScoringInput } from '../contracts/football';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function adaptForgeWeeklyPlayerInput(input: ForgeWeeklyPlayerInput): NormalizedFootballScoringInput {
  const injuryStatus = input.injuryStatus ?? 'healthy';
  const practiceParticipation = input.practiceParticipation ?? 'none';
  const activeProjectionHint = input.activeProjection?.trim().toLowerCase() ?? '';
  const confidenceHint = input.dataConfidenceHint?.trim().toLowerCase() ?? '';
  const activeProjection =
    activeProjectionHint.includes('inactive') || activeProjectionHint.includes('out')
      ? 'expected_inactive'
      : activeProjectionHint.includes('game') ||
        activeProjectionHint.includes('decision') ||
        activeProjectionHint.includes('questionable') ||
        activeProjectionHint.includes('limited') ||
        activeProjectionHint.includes('risk')
      ? 'risky'
      : activeProjectionHint.length === 0 || activeProjectionHint.includes('unknown')
      ? injuryStatus === 'out'
        ? 'expected_inactive'
        : 'risky'
      : 'expected_active';
  const opponentDefenseTier = input.opponentDefenseTier ?? 'neutral';
  const expectedGameScript = input.expectedGameScript ?? 'neutral';
  const dataConfidenceHint =
    confidenceHint.includes('high') || confidenceHint.includes('strong')
      ? 0.92
      : confidenceHint.includes('medium') || confidenceHint.includes('moderate')
      ? 0.72
      : confidenceHint.includes('low') || confidenceHint.includes('weak')
      ? 0.46
      : input.featureCoverage;

  return {
    playerId: input.playerId,
    playerName: input.playerName,
    team: input.team,
    opponent: input.opponent ?? 'UNK',
    position: input.position,
    injuryStatus,
    tags: [`football-week-${input.week}`, `football-season-${input.season}`],
    supportFlags: input.qualityFlags ?? [],
    opportunity: {
      snapShare: clamp(input.snapShare ?? 0.4, 0, 1),
      routeParticipation: clamp(input.routeParticipation ?? 0.4, 0, 1),
      rushAttempts: Math.max(0, input.rushAttempts ?? 0),
      targets: Math.max(0, input.targets ?? 0),
      redZoneTouches: Math.max(0, input.redZoneTouches ?? 0),
      goalLineTouches: Math.max(0, input.goalLineTouches ?? 0)
    },
    efficiency: {
      yardsPerRouteRun: clamp(input.yardsPerRouteRun ?? 1.1, 0, 5),
      yardsPerCarry: clamp(input.yardsPerCarry ?? 3.8, 0, 8),
      catchRate: clamp(input.catchRate ?? 0.65, 0, 1),
      fantasyPointsPerOpportunity: clamp(input.fantasyPointsPerOpportunity ?? 0.6, 0, 2.5),
      explosivePlayRate: clamp(input.explosivePlayRate ?? 0.08, 0, 1)
    },
    environment: {
      impliedTeamTotal: clamp(input.impliedTeamTotal ?? 21, 7, 40),
      spread: clamp(input.spread ?? 0, -20, 20),
      opponentDefenseTier,
      expectedGameScript
    },
    stability: {
      practiceParticipation,
      activeProjection,
      roleVolatility: clamp(input.roleVolatility ?? 0.35, 0, 1),
      featureCoverage: clamp(input.featureCoverage, 0, 1),
      dataConfidenceHint: clamp(dataConfidenceHint, 0, 1)
    },
    provenance: {
      sourceSetId: input.sourceSetId,
      sourceUpdatedAt: input.sourceUpdatedAt,
      asOf: input.asOf,
      season: input.season,
      week: input.week
    }
  };
}
