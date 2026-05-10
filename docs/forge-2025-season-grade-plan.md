# FORGE 2025 Season Grade Phase 1 Plan

## Purpose

Prepare `TIBER-FORGE` to grade the completed 2025 fantasy football season from source-backed artifacts supplied by `TIBER-Data` or from existing local fixtures while keeping the work docs/planning-only for Phase 1.

This plan does **not** implement the full UI, does **not** invent missing upstream truth, and does **not** convert FORGE into a projection model. The Phase 1 target is a deterministic, read-only season-grade lane that can be validated locally before any product presentation work.

## Explicit boundary

- **FORGE grades what happened.** A 2025 season grade is a retrospective evaluation of realized fantasy relevance, usage, efficiency, availability, fragility, and evidence coverage.
- **Point Prediction Model projects what happens next.** Future-week, ROS, best-ball, dynasty, and next-season projections should remain outside this season-grade lane unless a separate contract explicitly promotes them.
- **TIBER-Data owns source truth.** FORGE must consume governed source-backed artifacts and emit separate grades. FORGE must not patch missing PPR, usage, route, snap, identity, source, or timestamp data by silently changing scoring semantics.

## Current FORGE scoring surface

FORGE currently scores canonical weekly football records through `ForgeWeeklyPlayerInput/v1` and exposes three football-oriented paths:

1. `POST /api/forge/evaluate-football` for one weekly player input.
2. `POST /api/forge/rankings-football` for an in-memory weekly input array.
3. `POST /api/forge/rankings-football/from-artifact` for reading a local weekly artifact and ranking it.

The current weekly lane normalizes one player-week into four components:

- opportunity
- efficiency
- environment
- stability

It then emits an overall score, tier, confidence label, deterministic reasons, source metadata, and warnings. This is a useful base, but it is not yet a season-grade contract. Season grading needs a player-season input shape and validation that distinguishes sustained elite seasons from short-lived spikes.

## 1. Required input fields

Phase 1 should define a `ForgeSeasonPlayerInput/v1` artifact that is explicit about identity, season scope, PPR/fantasy outcomes, usage, efficiency, availability, provenance, and coverage.

### Required identity fields

These fields are required to identify and join the player deterministically:

- `playerId`: canonical TIBER player id used by FORGE as the stable route/key.
- `playerName`: display name at artifact build time.
- `position`: one of `QB`, `RB`, `WR`, `TE`.
- `team`: final/current team or primary team for the season artifact.
- `season`: `2025` for this plan.
- `externalPlayerIds`: optional but strongly preferred map containing source-backed ids, such as `gsisId`, `pfrId`, `sleeperId`, `espnId`, `yahooId`, or `sportradarId` when governed by TIBER-Data.

### Required season scope fields

These fields define what portion of the completed season is being graded:

- `seasonType`: recommended enum: `regular` for the initial Phase 1 contract; `postseason` and `all` can be deferred.
- `weeksIncluded`: ordered list of NFL weeks included in the aggregate.
- `gamesPlayed`: count of games with an offensive fantasy-relevant appearance.
- `gamesActive`: count of games active/available if supplied by source truth.
- `gamesMissed`: count of games missed, with injury/bye/team-context flags retained in quality metadata rather than invented by FORGE.
- `byeWeeks`: optional list if source-backed.

### Required fantasy/PPR outcome fields

PPR/fantasy points should be consumed as a **realized outcome pillar and validation field**, not as a projection. Required fields:

- `pprPoints`: total season PPR points.
- `pprPointsPerGame`: season PPR points divided by the source-backed denominator supplied by TIBER-Data.
- `fantasyRankOverall`: optional overall fantasy rank if TIBER-Data owns the calculation.
- `fantasyRankPosition`: position rank, e.g. WR1/RB1/QB1/TE1 evidence.
- `topNPositionBucket`: optional label such as `QB1`, `RB1`, `WR1`, `TE1`, `RB2`, `WR2`; FORGE may compute a display bucket only if the source rank is present and the bucket rule is documented.
- `scoringFormat`: initial value `ppr`.

### Required usage and volume fields

Season-grade usage should be source-backed totals plus rate fields, not inferred from FORGE weekly outputs alone:

- `snaps`: total offensive snaps.
- `snapShare`: weighted season snap share or denominator-specific average, with denominator documented.
- `routesRun`: total routes run when source-backed.
- `routeParticipation`: weighted season route participation when source-backed, or omitted if only proxy participation exists.
- `routeParticipationProxy`: optional explicitly-labeled proxy field when TIBER-Data supplies only proxy participation.
- `rushAttempts`: total rush attempts.
- `targets`: total targets.
- `receptions`: total receptions.
- `carriesPlusTargets` or `opportunities`: total fantasy-relevant opportunities, with definition included in artifact metadata.
- `redZoneTouches`: total red-zone touches.
- `goalLineTouches`: total goal-line touches.
- Position-specific optional totals: `passingAttempts`, `passingYards`, `passingTDs`, `interceptions`, `rushingYards`, `rushingTDs`, `receivingYards`, `receivingTDs`.

### Required efficiency fields

Efficiency should support explaining why high output was stable or fragile:

- `yardsPerRouteRun` for WR/TE/RB receiving evaluation when source-backed.
- `yardsPerCarry` for rushing evaluation.
- `yardsPerTarget` or `yardsPerReception` if source-backed.
- `catchRate`.
- `fantasyPointsPerOpportunity`.
- `explosivePlayRate`.
- `tdRatePerOpportunity`: touchdowns divided by relevant opportunities.
- `yardsPerTouch` for RB/TE/WR where appropriate.

### Required fragility and uncertainty fields

These fields should keep spike seasons from being graded as equally stable as high-volume elite seasons:

- `roleVolatility`: 0..1 upstream role volatility hint or FORGE-computed from source-backed weekly usage distribution in a documented season adapter.
- `weeklyPprStdDev`: standard deviation of weekly PPR points.
- `weeklyOpportunityStdDev`: standard deviation of weekly opportunities.
- `tdShareOfPpr`: share of PPR points from touchdowns.
- `lowVolumeEfficiencyFlag`: boolean or quality flag when elite efficiency occurred on low opportunities.
- `qualityFlags`: array of source or interpretation warnings.

### Required provenance and timestamp fields

These fields are required before FORGE should score a season artifact:

- `asOf`: ISO timestamp for the artifact build/evaluation context.
- `sourceUpdatedAt`: ISO timestamp for latest upstream source refresh included in the artifact.
- `sourceSetId`: deterministic id for the source bundle.
- `artifactVersion`: contract version, initially `ForgeSeasonPlayerInput/v1`.
- `sourceProviders`: list or map of underlying providers, owned by TIBER-Data.
- `featureCoverage`: 0..1 completeness indicator.
- `dataConfidenceHint`: optional 0..1 numeric value or enum once normalized by contract; avoid the current string ambiguity in any new season contract.
- `buildId`: deterministic artifact build id.

## 2. Current available inputs

### Available in FORGE today

- Weekly contract: `ForgeWeeklyPlayerInput` contains player identity, position/team/season/week, opportunity, efficiency, environment, stability, provenance, feature coverage, quality flags, and a data-confidence hint.
- Weekly adapter: FORGE maps missing weekly fields to deterministic defaults, clamps numeric fields, and normalizes active/data-confidence hints.
- Weekly scoring service: FORGE evaluates and ranks weekly inputs deterministically using opportunity, efficiency, environment, and stability components.
- Artifact ingestion: FORGE can read a JSON array from disk and validate it as `ForgeWeeklyPlayerInput[]`.
- Local fixtures: the repo includes 2024 weekly offline fixtures and one 2025 week-12 upstream-compatibility mirror fixture.
- Config expectation: the default sample artifact path points at `../TIBER-Data/data/gold/forge/forge_weekly_player_input_2025_w12.sample.json`, indicating the expected TIBER-Data handoff location for weekly 2025 artifacts even though this repo cannot assume that path exists locally.

### Available 2025 evidence in this repo

The only checked-in 2025 artifact fixture is:

- `tests/fixtures/artifacts/forge_weekly_player_input_2025_w12.upstream_compat.mirror.json`

It contains three week-12 sample player records and is sufficient for upstream compatibility smoke tests, but it is not sufficient for completed-season grading.

### Not available in FORGE today

FORGE does not currently include:

- a `ForgeSeasonPlayerInput/v1` contract;
- a 2025 completed-season artifact;
- season totals for PPR points, ranks, games, touchdowns, opportunities, weekly distributions, or season-level volatility;
- a season artifact ingestion function;
- season-specific validation thresholds;
- read-only season endpoints;
- UI/product presentation for season grades.

## 3. Missing TIBER-Data artifacts/contracts

Phase 1 requires TIBER-Data to provide or confirm the following before FORGE implementation should proceed:

1. **Completed 2025 season PPR artifact**
   - Suggested path: `data/gold/forge/forge_season_player_input_2025.ppr.v1.json`.
   - Shape: JSON object with artifact metadata and `players[]`, or a JSON array plus separate metadata if TIBER-Data strongly prefers existing array-only conventions.

2. **Stable player identity contract**
   - Canonical `playerId` and cross-id map.
   - Rules for traded players, duplicate names, team changes, inactive players, and rookies/free agents.

3. **Fantasy scoring contract**
   - PPR formula and stat sources.
   - Denominator for points per game.
   - Rank calculation rules, ties, minimum games, and position eligibility.

4. **Usage/volume contract**
   - Season totals and weighted rates for snaps, routes, route participation/proxy participation, carries, targets, red-zone touches, goal-line touches, and position-specific passing/rushing/receiving stats.
   - Clear labels when a route field is a proxy rather than true route participation.

5. **Weekly distribution support**
   - Weekly PPR list or summary stats for volatility.
   - Weekly opportunity list or summary stats for low-volume uncertainty.
   - Optional weekly source-set references so FORGE can explain which weeks drove a season grade.

6. **Source metadata contract**
   - Artifact-level and player-level `asOf`, `sourceUpdatedAt`, `sourceSetId`, `sourceProviders`, `featureCoverage`, quality flags, and build id.

7. **Contract versioning and validation fixture**
   - At least one golden 2025 season artifact fixture with known elite, WR1/RB1/QB1/TE1, TD-spike, and low-volume-efficiency cases.

## 4. Proposed season-grade artifact shape

Recommended top-level object shape:

```json
{
  "artifactVersion": "ForgeSeasonPlayerInput/v1",
  "season": 2025,
  "seasonType": "regular",
  "scoringFormat": "ppr",
  "asOf": "2026-01-05T12:00:00Z",
  "sourceUpdatedAt": "2026-01-05T11:45:00Z",
  "sourceSetId": "tiber-data-2025-season-ppr-v1",
  "buildId": "forge-season-2025-ppr-20260105T120000Z",
  "sourceProviders": ["tiber-data-governed-sources"],
  "players": [
    {
      "playerId": "canonical-player-id",
      "externalPlayerIds": {
        "gsisId": "00-0000000",
        "pfrId": "PlayNa00",
        "sleeperId": "1234"
      },
      "playerName": "Example Player",
      "position": "WR",
      "team": "MIN",
      "season": 2025,
      "seasonType": "regular",
      "weeksIncluded": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
      "gamesPlayed": 17,
      "gamesActive": 17,
      "pprPoints": 320.4,
      "pprPointsPerGame": 18.85,
      "fantasyRankPosition": 1,
      "topNPositionBucket": "WR1",
      "snaps": 930,
      "snapShare": 0.91,
      "routesRun": 610,
      "routeParticipation": 0.94,
      "rushAttempts": 4,
      "targets": 165,
      "receptions": 112,
      "redZoneTouches": 24,
      "goalLineTouches": 6,
      "receivingYards": 1540,
      "receivingTDs": 12,
      "yardsPerRouteRun": 2.52,
      "catchRate": 0.68,
      "fantasyPointsPerOpportunity": 1.9,
      "explosivePlayRate": 0.18,
      "tdRatePerOpportunity": 0.071,
      "weeklyPprStdDev": 7.2,
      "weeklyOpportunityStdDev": 3.4,
      "tdShareOfPpr": 0.23,
      "roleVolatility": 0.12,
      "featureCoverage": 0.98,
      "dataConfidenceHint": 0.95,
      "qualityFlags": [],
      "sourceUpdatedAt": "2026-01-05T11:45:00Z",
      "sourceSetId": "tiber-data-2025-season-ppr-v1"
    }
  ]
}
```

### Proposed grade output shape

FORGE should emit a separate grade artifact or endpoint response rather than mutating the TIBER-Data input:

```json
{
  "requestId": "season-2025-ppr-rankings",
  "season": 2025,
  "scoringFormat": "ppr",
  "count": 250,
  "rankings": [
    {
      "rank": 1,
      "player": {
        "playerId": "canonical-player-id",
        "playerName": "Example Player",
        "team": "MIN",
        "position": "WR"
      },
      "seasonGrade": {
        "overall": 94.1,
        "tier": "elite",
        "positionRank": 1,
        "components": [
          { "key": "realized_ppr", "label": "Realized PPR", "weight": 0.34, "score": 98.5 },
          { "key": "volume", "label": "Volume", "weight": 0.28, "score": 96.2 },
          { "key": "efficiency", "label": "Efficiency", "weight": 0.18, "score": 90.4 },
          { "key": "availability", "label": "Availability", "weight": 0.10, "score": 96.0 },
          { "key": "fragility", "label": "Fragility", "weight": 0.10, "score": 88.0 }
        ]
      },
      "confidence": {
        "score": 0.95,
        "label": "high",
        "deterministic": true
      },
      "warnings": [],
      "source": {
        "provider": "tiber-forge-season-grade",
        "inputContract": "ForgeSeasonPlayerInput/v1",
        "sourceSetId": "tiber-data-2025-season-ppr-v1",
        "generatedAt": "2026-01-05T12:00:00Z"
      }
    }
  ]
}
```

Recommended initial component weights for calibration discussion only:

- `realized_ppr`: 0.34
- `volume`: 0.28
- `efficiency`: 0.18
- `availability`: 0.10
- `fragility`: 0.10

These are deliberately different from weekly scoring because a completed-season grade should reward realized outcome and season-long durability while still exposing fragility.

## Can current weekly scoring aggregate into season-level grades?

Partially, but not safely as the sole Phase 1 season grade.

### What can aggregate

- Weekly opportunity fields can be summed or averaged if every week is present and denominator rules are clear.
- Weekly efficiency fields can become weighted season rates if the weights/denominators are supplied or derivable from source-backed fields.
- Weekly quality flags can roll up into season quality flags.
- Weekly confidence/support can inform season confidence.

### What should not be inferred only from weekly FORGE scores

- Completed-season fantasy rank.
- PPR total and PPG unless actual fantasy scoring data is present.
- Route participation if only proxy participation exists.
- Games played/active/missed unless supplied by TIBER-Data.
- Fragility from touchdowns unless touchdown and opportunity totals are supplied.
- Season elite/mediocre classification by averaging weekly overall scores alone.

### Recommended Phase 1 stance

Use weekly artifacts as optional evidence and fixture scaffolding, but require a season-level TIBER-Data artifact for official 2025 season grades. If a temporary local fixture is needed, label it as a fixture and keep it out of source-truth claims.

## Can PPR/fantasy points be consumed?

Yes. For a completed season, PPR/fantasy points are an input pillar and a validation field because FORGE is grading what happened. They should be consumed only when source-backed by TIBER-Data with a documented scoring formula, denominator, and timestamp.

Recommended handling:

- Treat `pprPoints`, `pprPointsPerGame`, and `fantasyRankPosition` as realized outcome evidence.
- Do not let PPR fully dominate the grade; use volume, efficiency, availability, and fragility to explain whether the season was stable, fragile, or uncertain.
- Use PPR rank validation to catch impossible outputs, such as a top-three WR season grading as mediocre without severe quality/coverage warnings.

## 5. Proposed validation checks

Phase 1 should add deterministic fixtures and tests before exposing read-only season endpoints.

### Elite season should grade elite

Fixture shape:

- top positional rank or top overall PPR profile;
- high PPR total and PPG;
- high volume;
- healthy availability;
- high feature coverage;
- no severe quality flags.

Expected behavior:

- overall grade lands in an `elite` tier;
- confidence is high;
- explanations identify realized PPR and volume as primary supports.

### WR1/RB1/QB1/TE1 seasons should not grade mediocre

Fixture shape:

- one example per position with `fantasyRankPosition` in the top 12 QB/TE or top 12/24 RB/WR depending on documented bucket rules;
- source-backed PPR totals and volume appropriate to the position.

Expected behavior:

- grade must be above `mediocre`/`neutral` unless strong missing-data or quality warnings are present;
- position-aware rank expectations prevent TE/QB/RB/WR scale mismatches.

### TD spike seasons should show fragility

Fixture shape:

- high PPR result;
- modest targets/carries/opportunities;
- high `tdRatePerOpportunity` and high `tdShareOfPpr`;
- elevated weekly PPR volatility.

Expected behavior:

- realized PPR component can be strong;
- fragility component should be meaningfully lower;
- reasons should explain touchdown concentration and volatility;
- confidence should not be fake-high if usage evidence is thin.

### Low-volume efficiency seasons should show uncertainty

Fixture shape:

- strong yards-per-touch or fantasy-points-per-opportunity;
- low snaps/routes/carries/targets;
- limited games or low opportunity total;
- good source metadata but low sample size.

Expected behavior:

- efficiency component can be high;
- volume and confidence should cap the overall grade;
- warnings/reasons should distinguish source confidence from football-signal uncertainty.

### Source metadata/timestamp validation

Checks:

- reject missing `artifactVersion`, `asOf`, `sourceUpdatedAt`, `sourceSetId`, `buildId`, and player-level `sourceSetId` when required;
- reject invalid ISO timestamps;
- require season `2025` for the dedicated 2025 endpoint;
- require `scoringFormat: "ppr"` for Phase 1;
- surface stale or mixed source sets as warnings rather than silently ignoring them.

### Identity validation

Checks:

- reject missing canonical `playerId`, `playerName`, `position`, or `team`;
- reject duplicate `playerId` records unless TIBER-Data defines an explicit traded-player split contract;
- validate positions are limited to `QB`, `RB`, `WR`, `TE` for Phase 1;
- preserve external ids but do not require every provider id.

## 6. Proposed minimal read-only endpoints

Do not build the full UI in Phase 1. Add read-only service endpoints after the season contract and fixture validations are in place.

### `GET /season/2025/rankings`

Purpose:

- Return deterministic 2025 PPR season grades sorted descending by overall grade.

Recommended query parameters:

- `position=QB|RB|WR|TE` optional filter.
- `limit=number` optional cap.
- `includeExplanations=true|false` optional response-size control.

Behavior:

- Reads a configured local season artifact path, e.g. `FORGE_SEASON_2025_INPUT_ARTIFACT_PATH`.
- Validates `ForgeSeasonPlayerInput/v1`.
- Emits ranking response with artifact/source warnings.
- Does not mutate source artifacts.

### `GET /season/2025/players/:playerId/grade`

Purpose:

- Return one player's deterministic 2025 PPR season grade.

Behavior:

- Reads the same configured artifact or a cached validated in-memory representation.
- Looks up canonical `playerId` only; name search and fuzzy matching belong in product/UI layers.
- Returns 404 if not found.
- Includes source metadata, confidence, component scores, and deterministic reasons.

## Phase 1 implementation sequence

1. Confirm or receive TIBER-Data artifact contract for `ForgeSeasonPlayerInput/v1`.
2. Add TypeScript interfaces and runtime validation for season artifact metadata and player records.
3. Add local fixture(s) for the validation cases above.
4. Add season artifact ingestion from a configured local file path.
5. Add season grading service with explicit component weights and no projection semantics.
6. Add tests for validation, elite/WR1/RB1/QB1/TE1 behavior, TD-spike fragility, low-volume uncertainty, sorting, and missing-source rejection.
7. Add minimal read-only endpoints only after local fixtures pass.
8. Update OpenAPI only for the read-only endpoints once implemented.

## Phase 1 non-goals

- No full UI.
- No live TIBER-Data API pull.
- No mutation of TIBER-Data artifacts.
- No fuzzy player search.
- No next-week or 2026 projections.
- No dynasty, ROS, or best-ball claims.
- No hidden route-data inference.
- No treating proxy participation as true route participation.
- No broad scoring rewrite beyond the season-grade lane.
