import { ForgeSeasonPlayerGrade, ForgeSeasonPlayerInputV1, ForgeSeasonRankingsResult } from '../contracts/football';

export const FORGE_PLAYER_STATIC_SCHEMA_VERSION = 'forge_player_static_v1';
export const FORGE_PLAYER_STATIC_MODEL_VERSION = 'forge-player-static-v1.0.0';

export type ForgePlayerStaticScoreSource = 'player_specific' | 'fallback_default' | 'generated_baseline';
export type ForgePlayerStaticEvidenceStatus = 'player_specific' | 'unsupported_by_input' | 'fallback_default' | 'generated_baseline';

export interface ForgePlayerStaticComponent {
  score: number | null;
  evidence_status: ForgePlayerStaticEvidenceStatus;
  evidence: string;
  source_component_keys: string[];
}

export interface ForgePlayerStaticRowV1 {
  schema_version: typeof FORGE_PLAYER_STATIC_SCHEMA_VERSION;
  player_id: string;
  player_name: string;
  position: ForgeSeasonPlayerInputV1['position'];
  team: string;
  forge_alpha: number;
  forge_tier: ForgeSeasonPlayerGrade['tier'];
  confidence: ForgeSeasonPlayerGrade['confidence'];
  components: {
    age_curve: ForgePlayerStaticComponent;
    production_profile: ForgePlayerStaticComponent;
    role_security: ForgePlayerStaticComponent;
    market_strength: ForgePlayerStaticComponent;
    positional_leverage: ForgePlayerStaticComponent;
  };
  provenance: {
    generated_at: string;
    model_version: typeof FORGE_PLAYER_STATIC_MODEL_VERSION;
    source_artifacts: string[];
    source_set_id: string;
    source_provider: string;
    source_updated_at: string;
    score_source: ForgePlayerStaticScoreSource;
    input_mode: ForgeSeasonPlayerInputV1['inputMode'];
  };
  evidence_summary: string[];
  warnings: string[];
}

export interface ForgePlayerStaticArtifactV1 {
  schema_version: typeof FORGE_PLAYER_STATIC_SCHEMA_VERSION;
  artifact_type: 'FORGE_PLAYER_STATIC_V1';
  generated_at: string;
  model_version: typeof FORGE_PLAYER_STATIC_MODEL_VERSION;
  row_count: number;
  score_source_policy: {
    player_specific: string;
    fallback_default: string;
    generated_baseline: string;
  };
  source_artifacts: string[];
  rows: ForgePlayerStaticRowV1[];
  warnings: string[];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function seasonComponent(grade: ForgeSeasonPlayerGrade, key: string): number | null {
  return grade.components.find((component) => component.key === key)?.score ?? null;
}

function average(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => typeof value === 'number');
  return present.length === 0 ? null : round(present.reduce((sum, value) => sum + value, 0) / present.length);
}

function inputByPlayerId(inputs: ForgeSeasonPlayerInputV1[]): Map<string, ForgeSeasonPlayerInputV1> {
  return new Map(inputs.map((input) => [input.playerId, input]));
}

function scoreSourceForInput(input: ForgeSeasonPlayerInputV1): ForgePlayerStaticScoreSource {
  if (input.inputMode === 'source-backed-cohort') {
    return 'player_specific';
  }
  return input.fixtureSemantics === 'sample-only-retrospective-fixture' ? 'generated_baseline' : 'fallback_default';
}

function evidenceStatusForInput(input: ForgeSeasonPlayerInputV1): ForgePlayerStaticEvidenceStatus {
  const scoreSource = scoreSourceForInput(input);
  return scoreSource === 'player_specific' ? 'player_specific' : scoreSource;
}

function unsupportedComponent(evidence: string): ForgePlayerStaticComponent {
  return {
    score: null,
    evidence_status: 'unsupported_by_input',
    evidence,
    source_component_keys: []
  };
}

function productionProfileComponent(grade: ForgeSeasonPlayerGrade, input: ForgeSeasonPlayerInputV1): ForgePlayerStaticComponent {
  return {
    score: average([seasonComponent(grade, 'realized_ppr'), seasonComponent(grade, 'efficiency')]),
    evidence_status: evidenceStatusForInput(input),
    evidence: `Compiled from player-specific realized PPR (${input.pprPoints}) and FORGE efficiency scoring for the supplied ${input.season} season artifact row.`,
    source_component_keys: ['realized_ppr', 'efficiency']
  };
}

function roleSecurityComponent(grade: ForgeSeasonPlayerGrade, input: ForgeSeasonPlayerInputV1): ForgePlayerStaticComponent {
  return {
    score: average([seasonComponent(grade, 'volume'), seasonComponent(grade, 'availability'), seasonComponent(grade, 'fragility')]),
    evidence_status: evidenceStatusForInput(input),
    evidence: `Compiled from player-specific volume, games played (${input.games}), and fragility guards for the supplied ${input.season} season artifact row.`,
    source_component_keys: ['volume', 'availability', 'fragility']
  };
}

function rowWarnings(input: ForgeSeasonPlayerInputV1, grade: ForgeSeasonPlayerGrade): string[] {
  const warnings = [...grade.warnings];
  if (scoreSourceForInput(input) !== 'player_specific') {
    warnings.push('This row is not player-specific source-backed FORGE evidence and must not be treated as player-specific by downstream consumers.');
  }
  warnings.push('Static v1 does not score age_curve or market_strength because the current FORGE-owned input does not contain age or market evidence.');
  warnings.push('Static v1 does not make Team Direction, ROP, or Point Prediction claims.');
  return [...new Set(warnings)];
}

export function buildForgePlayerStaticArtifact(
  inputs: ForgeSeasonPlayerInputV1[],
  rankings: ForgeSeasonRankingsResult,
  options: { generatedAt?: string; sourceArtifacts?: string[]; sourceProvider?: string } = {}
): ForgePlayerStaticArtifactV1 {
  const inputsByPlayerId = inputByPlayerId(inputs);
  const generatedAt = options.generatedAt ?? inputs[0]?.asOf ?? new Date(0).toISOString();
  const sourceArtifacts = options.sourceArtifacts ?? [];
  const sourceProvider = options.sourceProvider ?? inputs[0]?.sourceBackedCohort?.sourceProvider ?? (inputs[0]?.inputMode === 'source-backed-cohort' ? 'TIBER-Data' : 'fixture');

  const rows = rankings.rankings.map((grade) => {
    const input = inputsByPlayerId.get(grade.player.playerId);
    if (!input) {
      throw new Error(`Missing source input for ranked player ${grade.player.playerId}.`);
    }

    return {
      schema_version: FORGE_PLAYER_STATIC_SCHEMA_VERSION,
      player_id: grade.player.playerId,
      player_name: grade.player.playerName,
      position: grade.player.position,
      team: grade.player.team,
      forge_alpha: grade.score,
      forge_tier: grade.tier,
      confidence: grade.confidence,
      components: {
        age_curve: unsupportedComponent('No age or date-of-birth field is present in the current FORGE-owned season input contract.'),
        production_profile: productionProfileComponent(grade, input),
        role_security: roleSecurityComponent(grade, input),
        market_strength: unsupportedComponent('No ADP, trade market, salary, or roster market field is present in the current FORGE-owned season input contract.'),
        positional_leverage: unsupportedComponent('Static v1 avoids generic position baselines; no player-specific positional leverage evidence is present in the current input contract.')
      },
      provenance: {
        generated_at: generatedAt,
        model_version: FORGE_PLAYER_STATIC_MODEL_VERSION,
        source_artifacts: sourceArtifacts,
        source_set_id: input.sourceSetId,
        source_provider: sourceProvider,
        source_updated_at: input.sourceUpdatedAt,
        score_source: scoreSourceForInput(input),
        input_mode: input.inputMode ?? 'fixture'
      },
      evidence_summary: [
        `FORGE alpha ${grade.score} / ${grade.tier} is compiled from player-specific retrospective season scoring components where score_source=player_specific.`,
        'Unsupported static components remain null rather than being filled with generic baselines.',
        `Confidence is ${grade.confidence.label} (${grade.confidence.score}) from the existing deterministic FORGE season confidence model.`
      ],
      warnings: rowWarnings(input, grade)
    } satisfies ForgePlayerStaticRowV1;
  });

  return {
    schema_version: FORGE_PLAYER_STATIC_SCHEMA_VERSION,
    artifact_type: 'FORGE_PLAYER_STATIC_V1',
    generated_at: generatedAt,
    model_version: FORGE_PLAYER_STATIC_MODEL_VERSION,
    row_count: rows.length,
    score_source_policy: {
      player_specific: 'The row is compiled from source-backed player identity and player-specific statistical evidence supplied to FORGE.',
      fallback_default: 'The row is an explicit fallback/default and must not be interpreted as player-specific FORGE evidence.',
      generated_baseline: 'The row is generated from fixture/sample/baseline semantics and must not be interpreted as player-specific FORGE evidence.'
    },
    source_artifacts: sourceArtifacts,
    rows,
    warnings: [
      'FORGE_PLAYER_STATIC_V1 is an evidence compiler artifact, not a projection artifact.',
      'Missing artifacts should be treated by downstream consumers as unavailable FORGE evidence, not as zero-valued player evidence.',
      'Rows with provenance.score_source other than player_specific are explicit fallback/default/baseline rows.'
    ]
  };
}
