import { createHash } from 'node:crypto';
import { ForgeSeasonPlayerGrade, ForgeSeasonPlayerInputV1, ForgeSeasonRankingsResult } from '../contracts/football';

export const FORGE_PLAYER_STATIC_SCHEMA_VERSION = 'forge_player_static_v1';
export const FORGE_PLAYER_STATIC_DIGEST_ALGORITHM = 'sha256';
export const FORGE_PLAYER_STATIC_DIGEST_SCOPE = 'rows';
export const FORGE_PLAYER_STATIC_DIGEST_CANONICALIZATION = 'json_sorted_keys_no_whitespace_v1';
export const FORGE_PLAYER_STATIC_MODEL_VERSION = 'forge-player-static-v1.0.0';
export const FORGE_PLAYER_STATIC_PLAYER_EVIDENCE_SCORE_SOURCE = 'player_specific';

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

export interface ForgePlayerStaticConsumerManifestV1 {
  contract_name: 'FORGE_PLAYER_STATIC_V1_DOWNSTREAM_CONSUMPTION';
  evidence_gate: {
    player_specific_forge_evidence: 'row.provenance.score_source === "player_specific"';
    non_evidence_score_sources: Array<'fallback_default' | 'generated_baseline'>;
    unknown_score_source_behavior: 'non_evidence_unless_explicitly_supported';
  };
  generated_baseline_policy: string;
  required_row_fields: string[];
  recommended_consumer_counters: string[];
  fail_closed_behavior: {
    missing_artifact: 'unavailable_forge_evidence';
    malformed_artifact: 'unavailable_forge_evidence';
    duplicate_player_ids: 'invalid_artifact';
    unknown_score_source: 'non_evidence_unless_explicitly_supported';
    content_digest_mismatch: 'unavailable_forge_evidence';
  };
}

export interface ForgePlayerStaticConsumerConformanceResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  counters: {
    player_specific_coverage: number;
    generated_baseline_visibility: number;
    unresolved_identity_misses: number;
    unsupported_missing_artifact_state: number;
  };
}

export interface ForgePlayerStaticContentDigestV1 {
  algorithm: typeof FORGE_PLAYER_STATIC_DIGEST_ALGORITHM;
  scope: typeof FORGE_PLAYER_STATIC_DIGEST_SCOPE;
  canonicalization: typeof FORGE_PLAYER_STATIC_DIGEST_CANONICALIZATION;
  value: string;
}

export interface ForgePlayerStaticArtifactV1 {
  schema_version: typeof FORGE_PLAYER_STATIC_SCHEMA_VERSION;
  artifact_type: 'FORGE_PLAYER_STATIC_V1';
  generated_at: string;
  model_version: typeof FORGE_PLAYER_STATIC_MODEL_VERSION;
  content_digest: ForgePlayerStaticContentDigestV1;
  row_count: number;
  score_source_policy: {
    player_specific: string;
    fallback_default: string;
    generated_baseline: string;
  };
  consumer_manifest: ForgePlayerStaticConsumerManifestV1;
  source_artifacts: string[];
  rows: ForgePlayerStaticRowV1[];
  warnings: string[];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  throw new Error(`Cannot canonicalize non-JSON value of type ${typeof value} for FORGE_PLAYER_STATIC_V1 digest.`);
}

/**
 * Content-addressed digest over the canonicalized rows array. Producers stamp
 * it at build time; consumers must recompute it over the rows they read and
 * fail closed on mismatch instead of trusting descriptive provenance.
 */
export function computeForgePlayerStaticRowsDigest(rows: unknown): string {
  if (!Array.isArray(rows)) {
    throw new Error('FORGE_PLAYER_STATIC_V1 digest scope is the rows array; received a non-array.');
  }
  return createHash('sha256').update(canonicalJson(rows), 'utf8').digest('hex');
}

export function buildForgePlayerStaticContentDigest(rows: unknown): ForgePlayerStaticContentDigestV1 {
  return {
    algorithm: FORGE_PLAYER_STATIC_DIGEST_ALGORITHM,
    scope: FORGE_PLAYER_STATIC_DIGEST_SCOPE,
    canonicalization: FORGE_PLAYER_STATIC_DIGEST_CANONICALIZATION,
    value: computeForgePlayerStaticRowsDigest(rows)
  };
}

function seasonComponent(grade: ForgeSeasonPlayerGrade, key: string): number | null {
  return grade.components.find((component) => component.key === key)?.score ?? null;
}

function average(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => typeof value === 'number');
  return present.length === 0 ? null : round(present.reduce((sum, value) => sum + value, 0) / present.length);
}

function inputByPlayerId(inputs: ForgeSeasonPlayerInputV1[]): Map<string, ForgeSeasonPlayerInputV1> {
  const byPlayerId = new Map<string, ForgeSeasonPlayerInputV1>();
  for (const input of inputs) {
    if (byPlayerId.has(input.playerId)) {
      throw new Error(`Duplicate canonical player_id supplied to FORGE_PLAYER_STATIC_V1 builder: ${input.playerId}.`);
    }
    byPlayerId.set(input.playerId, input);
  }
  return byPlayerId;
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

function sourceProviderForInput(input: ForgeSeasonPlayerInputV1, fallbackSourceProvider?: string): string {
  if (input.inputMode === 'source-backed-cohort') {
    return input.sourceBackedCohort?.sourceProvider ?? fallbackSourceProvider ?? 'TIBER-Data';
  }
  if (scoreSourceForInput(input) === 'generated_baseline') {
    return 'FORGE generated baseline fixture';
  }
  return fallbackSourceProvider ?? 'fallback/default';
}

function evidenceSubjectForInput(input: ForgeSeasonPlayerInputV1): string {
  return scoreSourceForInput(input) === 'player_specific' ? 'player-specific' : `${scoreSourceForInput(input).replace('_', ' ')} non-player-specific`;
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
    evidence: `Compiled from ${evidenceSubjectForInput(input)} realized PPR (${input.pprPoints}) and FORGE efficiency scoring for the supplied ${input.season} season artifact row.`,
    source_component_keys: ['realized_ppr', 'efficiency']
  };
}

function roleSecurityComponent(grade: ForgeSeasonPlayerGrade, input: ForgeSeasonPlayerInputV1): ForgePlayerStaticComponent {
  return {
    score: average([seasonComponent(grade, 'volume'), seasonComponent(grade, 'availability'), seasonComponent(grade, 'fragility')]),
    evidence_status: evidenceStatusForInput(input),
    evidence: `Compiled from ${evidenceSubjectForInput(input)} volume, games played (${input.games}), and fragility guards for the supplied ${input.season} season artifact row.`,
    source_component_keys: ['volume', 'availability', 'fragility']
  };
}

function consumerManifest(): ForgePlayerStaticConsumerManifestV1 {
  return {
    contract_name: 'FORGE_PLAYER_STATIC_V1_DOWNSTREAM_CONSUMPTION',
    evidence_gate: {
      player_specific_forge_evidence: 'row.provenance.score_source === "player_specific"',
      non_evidence_score_sources: ['fallback_default', 'generated_baseline'],
      unknown_score_source_behavior: 'non_evidence_unless_explicitly_supported'
    },
    generated_baseline_policy:
      'generated_baseline rows are visibility scaffolding only and must not count toward Team Direction, FORGE coverage, confidence, roster strength, or player-specific alpha totals.',
    required_row_fields: [
      'schema_version',
      'player_id',
      'player_name',
      'position',
      'team',
      'forge_alpha',
      'forge_tier',
      'confidence',
      'components',
      'provenance.score_source',
      'provenance.source_provider',
      'provenance.source_set_id',
      'provenance.source_updated_at'
    ],
    recommended_consumer_counters: [
      'player_specific_coverage',
      'generated_baseline_visibility',
      'unresolved_identity_misses',
      'unsupported_missing_artifact_state'
    ],
    fail_closed_behavior: {
      missing_artifact: 'unavailable_forge_evidence',
      malformed_artifact: 'unavailable_forge_evidence',
      duplicate_player_ids: 'invalid_artifact',
      unknown_score_source: 'non_evidence_unless_explicitly_supported',
      content_digest_mismatch: 'unavailable_forge_evidence'
    }
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
  const sourceProvider = options.sourceProvider;

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
        source_provider: sourceProviderForInput(input, sourceProvider),
        source_updated_at: input.sourceUpdatedAt,
        score_source: scoreSourceForInput(input),
        input_mode: input.inputMode ?? 'fixture'
      },
      evidence_summary: [
        scoreSourceForInput(input) === 'player_specific'
          ? `FORGE alpha ${grade.score} / ${grade.tier} is compiled from player-specific retrospective season scoring components where score_source=player_specific.`
          : `FORGE alpha ${grade.score} / ${grade.tier} is compiled from explicit ${scoreSourceForInput(input)} retrospective season scoring inputs and must not be treated as player-specific evidence.`,
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
    content_digest: buildForgePlayerStaticContentDigest(rows),
    row_count: rows.length,
    score_source_policy: {
      player_specific: 'The row is compiled from source-backed player identity and player-specific statistical evidence supplied to FORGE. This is the only score_source that counts as player-specific FORGE evidence.',
      fallback_default: 'The row is an explicit fallback/default and must not be interpreted as player-specific FORGE evidence.',
      generated_baseline: 'The row is generated from fixture/sample/baseline semantics and must not be interpreted as player-specific FORGE evidence, Team Direction input, FORGE coverage, confidence input, roster strength input, or player-specific alpha.'
    },
    consumer_manifest: consumerManifest(),
    source_artifacts: sourceArtifacts,
    rows,
    warnings: [
      'FORGE_PLAYER_STATIC_V1 is an evidence compiler artifact, not a projection artifact.',
      'Missing artifacts should be treated by downstream consumers as unavailable FORGE evidence, not as zero-valued player evidence.',
      'Rows with provenance.score_source other than player_specific are explicit fallback/default/baseline rows.',
      'Unknown provenance.score_source values are non-evidence unless a future contract explicitly supports them.'
    ]
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateForgePlayerStaticConsumerContract(value: unknown): ForgePlayerStaticConsumerConformanceResult {
  const result: ForgePlayerStaticConsumerConformanceResult = {
    valid: true,
    errors: [],
    warnings: [],
    counters: {
      player_specific_coverage: 0,
      generated_baseline_visibility: 0,
      unresolved_identity_misses: 0,
      unsupported_missing_artifact_state: 0
    }
  };

  if (value === undefined || value === null) {
    result.valid = false;
    result.errors.push('FORGE_PLAYER_STATIC_V1 artifact is missing; FORGE evidence is unavailable.');
    result.counters.unsupported_missing_artifact_state = 1;
    return result;
  }

  if (!isRecord(value)) {
    result.valid = false;
    result.errors.push('FORGE_PLAYER_STATIC_V1 artifact must be a JSON object; FORGE evidence is unavailable.');
    result.counters.unsupported_missing_artifact_state = 1;
    return result;
  }

  if (value.schema_version !== FORGE_PLAYER_STATIC_SCHEMA_VERSION) {
    result.errors.push('schema_version must be forge_player_static_v1.');
  }
  if (value.artifact_type !== 'FORGE_PLAYER_STATIC_V1') {
    result.errors.push('artifact_type must be FORGE_PLAYER_STATIC_V1.');
  }
  if (!hasNonEmptyString(value.generated_at)) {
    result.errors.push('generated_at must be a non-empty string.');
  }
  if (value.model_version !== FORGE_PLAYER_STATIC_MODEL_VERSION) {
    result.errors.push(`model_version must be ${FORGE_PLAYER_STATIC_MODEL_VERSION}.`);
  }
  if (!Array.isArray(value.rows)) {
    result.errors.push('rows must be an array.');
  }
  if (typeof value.row_count !== 'number' || (Array.isArray(value.rows) && value.row_count !== value.rows.length)) {
    result.errors.push('row_count must equal rows.length.');
  }
  if (!isRecord(value.consumer_manifest)) {
    result.errors.push('consumer_manifest is required for downstream consumption.');
  }

  if (value.content_digest === undefined) {
    result.warnings.push(
      'content_digest is missing: this artifact predates integrity stamping, so substitution cannot be detected. Rebuild with a current builder.'
    );
  } else if (!isRecord(value.content_digest)) {
    result.errors.push('content_digest must be an object when present.');
  } else {
    const digest = value.content_digest;
    if (
      digest.algorithm !== FORGE_PLAYER_STATIC_DIGEST_ALGORITHM ||
      digest.scope !== FORGE_PLAYER_STATIC_DIGEST_SCOPE ||
      digest.canonicalization !== FORGE_PLAYER_STATIC_DIGEST_CANONICALIZATION
    ) {
      result.errors.push(
        `content_digest must declare algorithm=${FORGE_PLAYER_STATIC_DIGEST_ALGORITHM}, scope=${FORGE_PLAYER_STATIC_DIGEST_SCOPE}, canonicalization=${FORGE_PLAYER_STATIC_DIGEST_CANONICALIZATION}.`
      );
    } else if (!hasNonEmptyString(digest.value) || !/^[0-9a-f]{64}$/.test(digest.value)) {
      result.errors.push('content_digest.value must be a 64-character lowercase hex sha256.');
    } else if (Array.isArray(value.rows) && computeForgePlayerStaticRowsDigest(value.rows) !== digest.value) {
      result.errors.push(
        'content_digest does not match the recomputed digest of rows: the artifact content has been altered or substituted and must be treated as unavailable FORGE evidence.'
      );
    }
  }

  const rows = Array.isArray(value.rows) ? value.rows : [];
  const seenPlayerIds = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const path = `rows[${index}]`;
    if (!isRecord(row)) {
      result.errors.push(`${path} must be an object.`);
      continue;
    }
    if (row.schema_version !== FORGE_PLAYER_STATIC_SCHEMA_VERSION) {
      result.errors.push(`${path}.schema_version must be forge_player_static_v1.`);
    }
    if (!hasNonEmptyString(row.player_id)) {
      result.errors.push(`${path}.player_id must be a non-empty canonical player id.`);
      result.counters.unresolved_identity_misses += 1;
    } else if (seenPlayerIds.has(row.player_id)) {
      result.errors.push(`Duplicate player_id in FORGE_PLAYER_STATIC_V1 artifact: ${row.player_id}.`);
    } else {
      seenPlayerIds.add(row.player_id);
    }
    for (const field of ['player_name', 'position', 'team']) {
      if (!hasNonEmptyString(row[field])) {
        result.errors.push(`${path}.${field} must be a non-empty string.`);
      }
    }
    if (typeof row.forge_alpha !== 'number' || Number.isNaN(row.forge_alpha)) {
      result.errors.push(`${path}.forge_alpha must be a valid number.`);
    }
    if (!hasNonEmptyString(row.forge_tier)) {
      result.errors.push(`${path}.forge_tier must be a non-empty string.`);
    }
    if (!isRecord(row.confidence)) {
      result.errors.push(`${path}.confidence must be an object.`);
    }
    if (!isRecord(row.components)) {
      result.errors.push(`${path}.components must be an object.`);
    }
    if (!isRecord(row.provenance)) {
      result.errors.push(`${path}.provenance must be an object.`);
      continue;
    }

    const scoreSource = row.provenance.score_source;
    if (scoreSource === FORGE_PLAYER_STATIC_PLAYER_EVIDENCE_SCORE_SOURCE) {
      result.counters.player_specific_coverage += 1;
    } else if (scoreSource === 'generated_baseline') {
      result.counters.generated_baseline_visibility += 1;
    } else if (scoreSource !== 'fallback_default') {
      result.warnings.push(`${path}.provenance.score_source=${String(scoreSource)} is not explicitly supported and must be treated as non-evidence.`);
    }

    for (const field of ['source_provider', 'source_set_id', 'source_updated_at']) {
      if (!hasNonEmptyString(row.provenance[field])) {
        result.errors.push(`${path}.provenance.${field} must be a non-empty string.`);
      }
    }
  }

  result.valid = result.errors.length === 0;
  if (!result.valid) {
    result.counters.unsupported_missing_artifact_state = 1;
  }
  return result;
}
