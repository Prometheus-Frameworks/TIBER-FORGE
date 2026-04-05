import { FootballEvaluateRequest, ForgeWeeklyPlayerInput } from '../../src/contracts/football';

export const footballFixtureContext: FootballEvaluateRequest['context'] = {
  slateId: 'nfl-week-5-main',
  slateDate: '2026-10-11T17:00:00Z',
  sport: 'nfl',
  site: 'draftkings',
  contestType: 'tournament',
  mode: 'bootstrap-demo'
};

const baseProvenance = {
  season: 2026,
  week: 5,
  asOf: '2026-10-10T18:00:00Z',
  sourceUpdatedAt: '2026-10-10T18:05:00Z',
  sourceSetId: 'td-weekly-2026-w5-v1'
};

export const forgeFootballInputs: ForgeWeeklyPlayerInput[] = [
  {
    ...baseProvenance,
    playerId: 'wr-featured-1',
    playerName: 'Featured Wideout',
    team: 'ATL',
    opponent: 'CAR',
    position: 'WR',
    snapShare: 0.9,
    routeParticipation: 0.95,
    targets: 11,
    redZoneTouches: 3,
    yardsPerRouteRun: 2.5,
    catchRate: 0.71,
    fantasyPointsPerOpportunity: 0.86,
    explosivePlayRate: 0.19,
    impliedTeamTotal: 28,
    spread: -5,
    opponentDefenseTier: 'weak',
    expectedGameScript: 'neutral',
    injuryStatus: 'healthy',
    practiceParticipation: 'full',
    activeProjection: 'expected_active',
    roleVolatility: 0.11,
    featureCoverage: 0.98,
    dataConfidenceHint: 0.92,
    qualityFlags: []
  },
  {
    ...baseProvenance,
    playerId: 'qb-dual-1',
    playerName: 'Dual Threat QB',
    team: 'BUF',
    position: 'QB',
    snapShare: 1,
    routeParticipation: 0,
    rushAttempts: 9,
    targets: 0,
    goalLineTouches: 2,
    yardsPerCarry: 5.2,
    fantasyPointsPerOpportunity: 0.91,
    explosivePlayRate: 0.14,
    impliedTeamTotal: 27,
    spread: -2,
    opponentDefenseTier: 'neutral',
    expectedGameScript: 'negative',
    injuryStatus: 'healthy',
    practiceParticipation: 'limited',
    activeProjection: 'risky',
    roleVolatility: 0.2,
    featureCoverage: 0.94,
    dataConfidenceHint: 0.72,
    qualityFlags: []
  },
  {
    ...baseProvenance,
    playerId: 'fragile-wr-1',
    playerName: 'Fragile Deep Threat',
    team: 'NE',
    opponent: 'NYJ',
    position: 'WR',
    snapShare: 0.54,
    routeParticipation: 0.58,
    targets: 4,
    yardsPerRouteRun: 1.2,
    catchRate: 0.52,
    fantasyPointsPerOpportunity: 0.42,
    explosivePlayRate: 0.08,
    impliedTeamTotal: 18,
    spread: 6.5,
    opponentDefenseTier: 'strong',
    expectedGameScript: 'negative',
    injuryStatus: 'questionable',
    practiceParticipation: 'did_not_practice',
    activeProjection: 'risky',
    roleVolatility: 0.74,
    featureCoverage: 0.61,
    dataConfidenceHint: 0.46,
    qualityFlags: ['thin_sample', 'injury_noise']
  }
];

export const forgeFootballEvaluateFixture: FootballEvaluateRequest = {
  requestId: 'football-eval-featured',
  input: forgeFootballInputs[0],
  context: footballFixtureContext
};
