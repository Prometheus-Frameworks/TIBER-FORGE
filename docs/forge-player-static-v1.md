# FORGE_PLAYER_STATIC_V1

`FORGE_PLAYER_STATIC_V1` is the promoted static player evidence artifact for downstream consumers that need player-specific FORGE evidence without treating generic baselines as real player scoring.

FORGE is the evidence compiler for this artifact. It does not own raw source truth, roster identity, market data, TeamState, Role-and-opportunity, or Point Prediction inputs. It compiles the governed player rows it has, labels what was actually player-specific, and leaves unsupported evidence null instead of inventing precision.

## Promoted path

The promoted repository artifact is:

```text
exports/promoted/forge_player_static/forge_player_static_v1.json
```

Rebuild it from a validated source-backed cohort plus the default generated-baseline season universe with:

```bash
npm run build
node scripts/build-player-static-artifact.js \
  --source-backed-cohort tests/fixtures/artifacts/forge_player_weekly_ppr_2025.cohort.v1.json \
  --output exports/promoted/forge_player_static/forge_player_static_v1.json
```


## Current promoted coverage

The promoted repository artifact now contains a broader deterministic player universe and materially more true source-backed rows than the original two-row source-backed proof:

- 8 `player_specific` rows from the governed TIBER-Data source-backed cohort at `tests/fixtures/artifacts/forge_player_weekly_ppr_2025.cohort.v1.json`.
- 4 of those `player_specific` rows are now keyed by real canonical TIBER-Data player identities: `tiber-data-player-2025-jamarr-chase`, `tiber-data-player-2025-bijan-robinson`, `tiber-data-player-2025-josh-allen`, and `tiber-data-player-2025-sam-laporta`.
- 4 remaining source-backed rows still use governed cohort IDs while upstream real-player coverage continues to expand.
- 14 `generated_baseline` rows from `tests/fixtures/artifacts/forge_season_player_input_2025.real_players_sample.json`.
- 22 total rows ordered deterministically by FORGE score descending, then canonical `player_id` ascending for score ties.

The source-backed cohort is the only lane that currently counts as true player-specific FORGE evidence. Real canonical IDs in that lane use `provenance.score_source = "player_specific"`, `source_provider = "TIBER-Data"`, and the source cohort build ID. The generated-baseline rows expand roster-evaluation lookup visibility, but they are not live source-backed evidence. Consumers must continue to gate on `row.provenance.score_source` and may only treat `player_specific` rows as true player-specific FORGE evidence.

To rebuild only the governed source-backed cohort, pass `--no-generated-baselines` to the builder. To add another explicit baseline universe, pass one or more `--generated-baseline-season <path>` arguments; those rows remain `generated_baseline` when their season inputs carry `fixtureSemantics: sample-only-retrospective-fixture`.

## Current coverage limits and next expansion stage

This pass begins replacing governed placeholder identities with real canonical TIBER-Data player identities while keeping every generated/default row in the `generated_baseline` lane. Coverage remains intentionally small: four real canonical `player_specific` rows and four still-governed source cohort rows. It does not add TeamState, Role-and-opportunity, Point Prediction, Team Direction, age, market, or route evidence. The next coverage stage still belongs at the input/source boundary: continue replacing the remaining governed cohort IDs with more governed TIBER-Data player rows keyed by canonical identity, then expand the source-backed cohort size. FORGE should compile supplied rows as `player_specific`; it should not upgrade generated/default rows to player-specific without true player-specific upstream evidence.

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

- `production_profile`: scored from existing FORGE season components `realized_ppr` and `efficiency`; its `evidence_status` mirrors row provenance, so generated/default rows remain non-player-specific.
- `role_security`: scored from existing FORGE season components `volume`, `availability`, and `fragility`; its `evidence_status` mirrors row provenance, so generated/default rows remain non-player-specific.
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

Static v1 is not a projection artifact and does not blend TeamState, Role-and-opportunity, or Point Prediction. It compiles available source-backed and explicitly generated-baseline season rows into stable static rows while preserving confidence, warnings, provenance, and unsupported component labels.
