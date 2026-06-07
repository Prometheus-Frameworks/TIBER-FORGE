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

- 24 `player_specific` rows from the governed TIBER-Data source-backed cohort at `tests/fixtures/artifacts/forge_player_weekly_ppr_2025.cohort.v1.json`.
- All 24 `player_specific` rows are keyed by real canonical TIBER-Data player identities. The source-backed lane now covers a small cross-position cohort: Josh Allen, Lamar Jackson, Jalen Hurts, Patrick Mahomes, C.J. Stroud, Bijan Robinson, De'Von Achane, Jahmyr Gibbs, Breece Hall, Jonathan Taylor, Saquon Barkley, Ja'Marr Chase, Puka Nacua, Justin Jefferson, CeeDee Lamb, Amon-Ra St. Brown, Nico Collins, Sam LaPorta, Travis Kelce, Brock Bowers, Trey McBride, George Kittle, and Mark Andrews.
- No governed `cohort-` placeholder IDs remain in the `player_specific` lane.
- 14 `generated_baseline` rows from `tests/fixtures/artifacts/forge_season_player_input_2025.real_players_sample.json`.
- 38 total rows ordered deterministically by FORGE score descending, then canonical `player_id` ascending for score ties.

The source-backed cohort is the only lane that currently counts as true player-specific FORGE evidence. Canonical TIBER-Data IDs in that lane use `provenance.score_source = "player_specific"`, `source_provider = "TIBER-Data"`, and the source cohort build ID. The generated-baseline rows expand roster-evaluation lookup visibility, but they are not live source-backed evidence. Consumers must continue to gate on `row.provenance.score_source` and may only treat `player_specific` rows as true player-specific FORGE evidence.

To rebuild only the governed source-backed cohort, pass `--no-generated-baselines` to the builder. To add another explicit baseline universe, pass one or more `--generated-baseline-season <path>` arguments; those rows remain `generated_baseline` when their season inputs carry `fixtureSemantics: sample-only-retrospective-fixture`.

## Current coverage limits and next expansion stage

This pass expands the cleaned source-backed lane from 8 to 24 real canonical TIBER-Data player identities while keeping every generated/default row in the `generated_baseline` lane. Coverage remains intentionally small: 24 real canonical `player_specific` rows and 14 generated-baseline visibility rows. It does not add TeamState, Role-and-opportunity, Point Prediction, Team Direction, age, market, route evidence, or full-universe source coverage. The next coverage stage still belongs at the input/source boundary: expand the governed TIBER-Data source-backed cohort with additional real player rows keyed by canonical identity and real source-backed evidence. FORGE should compile supplied rows as `player_specific`; it should not upgrade generated/default rows to player-specific without true player-specific upstream evidence.

## Contract summary

Top-level artifact fields:

- `schema_version`: always `forge_player_static_v1`.
- `artifact_type`: always `FORGE_PLAYER_STATIC_V1`.
- `generated_at`: deterministic artifact generation timestamp. The default builder uses the source cohort `asOf` timestamp.
- `model_version`: static compiler version.
- `row_count`: number of emitted rows.
- `score_source_policy`: downstream-readable definitions for `player_specific`, `fallback_default`, and `generated_baseline`.
- `consumer_manifest`: machine-readable downstream consumption rules for the evidence gate, required row fields, recommended counters, and fail-closed behavior.
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

## Downstream consumption contract

Consumers, including TIBER-Fantasy, should read `FORGE_PLAYER_STATIC_V1` as an optional evidence artifact keyed by canonical `row.player_id`. The artifact is safe to index for lookup visibility, but only a subset of rows count as true FORGE evidence.

### Required consumer fields

A downstream consumer needs these top-level fields before using the artifact:

- `schema_version` equal to `forge_player_static_v1`.
- `artifact_type` equal to `FORGE_PLAYER_STATIC_V1`.
- `generated_at`.
- `model_version`.
- `row_count` matching `rows.length`.
- `score_source_policy`.
- `consumer_manifest`.
- `rows`.

A downstream consumer needs these row fields before using a row:

- `schema_version`.
- `player_id` as the canonical lookup key.
- `player_name`, `position`, and `team` for display/context only.
- `forge_alpha` and `forge_tier`, but only after the evidence gate passes.
- `confidence`, but only after the evidence gate passes.
- `components`, with unsupported component scores treated as unavailable/null rather than zero.
- `provenance.score_source`, `provenance.source_provider`, `provenance.source_set_id`, and `provenance.source_updated_at`.

### Evidence gate

The only true player-specific FORGE evidence gate is:

```js
row.provenance.score_source === "player_specific"
```

Only rows passing that exact gate may contribute to player-specific FORGE evidence, Team Direction inputs, FORGE coverage, confidence, roster strength, or player-specific alpha totals.

Rows with `provenance.score_source = "generated_baseline"` are visibility scaffolding only. They may help a shell explain that FORGE has a non-player-specific baseline row for a lookup, but they must not contribute to Team Direction, FORGE coverage, confidence, roster strength, or player-specific alpha totals.

Rows with `provenance.score_source = "fallback_default"` are also non-evidence. They should be displayed only as explicit fallback/default states if a consumer chooses to expose them.

Rows with an unknown `provenance.score_source` must fail closed as non-evidence unless a future FORGE contract explicitly supports that value. Unknown values are not permission to infer a new evidence lane.

### Recommended consumer counters

Consumers should maintain separate counters rather than collapsing every lookup into one coverage number:

- `player_specific_coverage`: count of requested canonical player IDs with a matching row where `provenance.score_source === "player_specific"`.
- `generated_baseline_visibility`: count of requested canonical player IDs with a matching row where `provenance.score_source === "generated_baseline"`; this is lookup visibility, not evidence coverage.
- `unresolved_identity_misses`: count of requested canonical player IDs that do not resolve to any artifact row.
- `unsupported_missing_artifact_state`: count/flag for cases where the artifact is missing, unreadable, malformed, or otherwise unavailable.

### Fail-closed behavior

Consumers should fail closed before wiring this artifact into live Management:

- Missing artifact: treat FORGE evidence as unavailable. Do not synthesize zero scores, baselines, Team Direction, confidence, roster strength, or alpha totals.
- Malformed artifact: treat FORGE evidence as unavailable. A partially readable malformed file is not a degraded confidence signal.
- Duplicate `player_id` values: treat the artifact as invalid because canonical lookup would be ambiguous.
- Unknown `score_source`: keep the row out of evidence counters and player-specific totals unless a future contract explicitly lists the value as supported.

The promoted artifact includes a lightweight `consumer_manifest` that repeats these rules in machine-readable form. FORGE also exposes `validateForgePlayerStaticConsumerContract(...)` for conformance checks; it verifies required top-level/row fields, duplicate IDs, safe source counters, and fail-closed missing/malformed states.

## Current limitations

Static v1 is not a projection artifact and does not blend TeamState, Role-and-opportunity, or Point Prediction. It compiles available source-backed and explicitly generated-baseline season rows into stable static rows while preserving confidence, warnings, provenance, and unsupported component labels.
