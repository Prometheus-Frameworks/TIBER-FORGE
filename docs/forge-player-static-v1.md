# FORGE_PLAYER_STATIC_V1

`FORGE_PLAYER_STATIC_V1` is the promoted static player evidence artifact for downstream consumers that need player-specific FORGE evidence without treating generic baselines as real player scoring.

FORGE is the evidence compiler for this artifact. It does not own raw source truth, roster identity, market data, TeamState, Role-and-opportunity, or Point Prediction inputs. It compiles the governed player rows it has, labels what was actually player-specific, and leaves unsupported evidence null instead of inventing precision.

## Promoted path

The promoted repository artifact is:

```text
exports/promoted/forge_player_static/forge_player_static_v1.json
```

Rebuild it from a validated source-backed cohort with:

```bash
npm run build
node scripts/build-player-static-artifact.js \
  --source-backed-cohort tests/fixtures/artifacts/forge_player_weekly_ppr_2025.cohort.v1.json \
  --output exports/promoted/forge_player_static/forge_player_static_v1.json
```

## Contract summary

Top-level artifact fields:

- `schema_version`: always `forge_player_static_v1`.
- `artifact_type`: always `FORGE_PLAYER_STATIC_V1`.
- `generated_at`: deterministic artifact generation timestamp. The default builder uses the source cohort `asOf` timestamp.
- `model_version`: static compiler version.
- `row_count`: number of emitted rows.
- `score_source_policy`: downstream-readable definitions for `player_specific`, `fallback_default`, and `generated_baseline`.
- `source_artifacts`: source artifact paths used by the compiler.
- `rows`: static player evidence rows.
- `warnings`: artifact-level consumer guidance.

Each row includes:

- `schema_version`
- `player_id`
- `player_name`
- `position`
- `team`
- `forge_alpha`
- `forge_tier`
- `confidence`
- `components`
- `provenance`
- `evidence_summary`
- `warnings`

## Component semantics

Static v1 exposes the requested dynasty component names, but each component is explicit about whether the current FORGE input supports it:

- `production_profile`: scored from existing player-specific FORGE season components `realized_ppr` and `efficiency`.
- `role_security`: scored from existing player-specific FORGE season components `volume`, `availability`, and `fragility`.
- `age_curve`: `score: null` and `evidence_status: unsupported_by_input` until a governed upstream age/date-of-birth field exists.
- `market_strength`: `score: null` and `evidence_status: unsupported_by_input` until governed market evidence exists.
- `positional_leverage`: `score: null` and `evidence_status: unsupported_by_input` in v1 because generic position baselines are not player-specific FORGE evidence.

Unsupported components are intentionally null, not zero. A null component means FORGE does not have contract-backed evidence for that component. It is not a poor player score.

## Provenance and fallback rules

Downstream consumers should use `row.provenance.score_source` as the primary gate:

- `player_specific`: safe to treat as player-specific FORGE evidence.
- `fallback_default`: explicit fallback/default row; do not treat as player-specific evidence.
- `generated_baseline`: generated/sample/baseline row; do not treat as player-specific evidence.

If the promoted artifact is missing, downstream consumers should display FORGE evidence as unavailable. They should not synthesize a zero score, position baseline, or Team Direction claim.

## Current limitations

Static v1 is not a projection artifact and does not blend TeamState, Role-and-opportunity, or Point Prediction. It compiles available source-backed season evidence into a stable static row while preserving confidence, warnings, provenance, and unsupported component labels.
