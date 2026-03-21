import { EvaluateRequest } from '../../src/contracts/forge';

const fixtureContext: EvaluateRequest['context'] = {
  slateId: 'slate-2026-03-21-main',
  slateDate: '2026-03-21T19:00:00Z',
  sport: 'nba',
  site: 'draftkings',
  contestType: 'tournament',
  mode: 'bootstrap-demo'
};

export interface ForgeParityFixture {
  id: string;
  name: string;
  note: string;
  request: EvaluateRequest;
}

export const forgeParityFixtures: ForgeParityFixture[] = [
  {
    id: 'elite-high-end',
    name: 'Elite high-end anchor',
    note: 'Healthy, premium, high-minutes ceiling case should remain the strongest bootstrap parity scenario in the pack.',
    request: {
      requestId: 'fixture-elite-high-end',
      context: fixtureContext,
      player: {
        playerId: 'elite-1',
        playerName: 'Elite Alpha',
        team: 'AAA',
        opponent: 'BBB',
        position: 'PG',
        salary: 9300,
        projectedMinutes: 37,
        recentFantasyPoints: 48,
        injuryStatus: 'healthy',
        tags: ['starter', 'ceiling']
      }
    }
  },
  {
    id: 'high-end-steady',
    name: 'High-end steady floor',
    note: 'Healthy high-end contributor with less ceiling than the elite case should still score comfortably above mid-tier fixtures.',
    request: {
      requestId: 'fixture-high-end-steady',
      context: fixtureContext,
      player: {
        playerId: 'steady-1',
        playerName: 'Steady Summit',
        team: 'KLM',
        opponent: 'NOP',
        position: 'SG',
        salary: 8500,
        projectedMinutes: 35,
        recentFantasyPoints: 40,
        injuryStatus: 'healthy',
        tags: ['starter']
      }
    }
  },
  {
    id: 'mid-tier-stable',
    name: 'Mid-tier stable starter',
    note: 'Reliable healthy mid-tier starter should outrank fragile availability-driven cases.',
    request: {
      requestId: 'fixture-mid-tier-stable',
      context: fixtureContext,
      player: {
        playerId: 'mid-1',
        playerName: 'Mid Stable',
        team: 'CCC',
        opponent: 'DDD',
        position: 'SF',
        salary: 7000,
        projectedMinutes: 32,
        recentFantasyPoints: 33,
        injuryStatus: 'healthy',
        tags: ['starter']
      }
    }
  },
  {
    id: 'volatile-questionable',
    name: 'Volatile questionable upside',
    note: 'Questionable tag plus lower minutes should make confidence shakier even when recent production is appealing.',
    request: {
      requestId: 'fixture-volatile-questionable',
      context: fixtureContext,
      player: {
        playerId: 'volatile-1',
        playerName: 'Volatile Flash',
        team: 'EEE',
        opponent: 'FFF',
        position: 'SG',
        salary: 7600,
        projectedMinutes: 24,
        recentFantasyPoints: 37,
        injuryStatus: 'questionable',
        tags: ['boom-bust']
      }
    }
  },
  {
    id: 'weak-opportunity',
    name: 'Weak opportunity flyer',
    note: 'Minutes-constrained healthy player should be penalized clearly by the weak-opportunity logic.',
    request: {
      requestId: 'fixture-weak-opportunity',
      context: fixtureContext,
      player: {
        playerId: 'weak-1',
        playerName: 'Weak Opportunity',
        team: 'GGG',
        opponent: 'HHH',
        position: 'PF',
        salary: 5800,
        projectedMinutes: 16,
        recentFantasyPoints: 18,
        injuryStatus: 'healthy',
        tags: []
      }
    }
  },
  {
    id: 'low-availability',
    name: 'Low availability starter',
    note: 'Playable baseline profile with doubtful status should stay meaningfully penalized versus healthier peers.',
    request: {
      requestId: 'fixture-low-availability',
      context: fixtureContext,
      player: {
        playerId: 'lowavail-1',
        playerName: 'Low Availability',
        team: 'III',
        opponent: 'JJJ',
        position: 'C',
        salary: 6800,
        projectedMinutes: 28,
        recentFantasyPoints: 31,
        injuryStatus: 'doubtful',
        tags: ['starter']
      }
    }
  }
];

export const forgeParityPlayers = forgeParityFixtures.map((fixture) => fixture.request.player);
export const forgeParityContext = fixtureContext;
