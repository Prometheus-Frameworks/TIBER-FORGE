# TIBER-FORGE Standalone Product Readiness Plan

## Audit scope

This audit evaluates the current repository as a candidate standalone deterministic fantasy signal/scoring engine that can be trusted by `TIBER-Fantasy`, Observatory, or other read-only consumers. It is intentionally a roadmap document only: no runtime scoring, API, UI, or deployment behavior is changed here.

Primary surfaces reviewed:

- scoring engine structure;
- current player grade outputs;
- ranking and tier logic;
- artifact inputs and outputs;
- UI availability;
- build, start, and test scripts;
- health and API availability;
- Railway deploy readiness;
- environment variables;
- local file and `TIBER-Fantasy`/`TIBER-Data` dependencies;
- TIBER-Data contract alignment;
- test coverage;
- stale or experimental code that should not be public-facing.

## 1. Current FORGE purpose

TIBER-FORGE is currently a deterministic fantasy signal/scoring engine with an early football-specific lane. Its correct responsibility is to evaluate canonical football inputs and artifact-backed weekly records, produce deterministic fantasy relevance grades, and expose inspectable score components, tiers, confidence labels, reasons, source metadata, and warnings.

FORGE should be treated as a downstream judge of supplied artifacts, not as a canonical data authority. It should not invent raw player usage, route data, injury truth, player identity, team context, or source metadata. When upstream artifacts are incomplete or low-confidence, FORGE should preserve and explain that uncertainty rather than silently patching it.

In standalone product terms, FORGE should become the trusted grading engine and read-only artifact surface that product clients can reference. `TIBER-Fantasy` or Observatory can own presentation, filtering, comparisons, and workflow orchestration, but the deterministic player-grade math and artifact-grade semantics should live here once the contracts are stable.

## 2. Current capabilities

### Service/runtime surface

- Node/TypeScript service with no web framework dependency; routes are handled through `node:http`.
- Required runtime mode is currently `FORGE_SERVICE_MODE=bootstrap-demo`.
- Liveness and readiness routes exist:
  - `GET /health` returns an `ok` status.
  - `GET /ready` returns readiness metadata.
- `GET /` returns bootstrap service metadata.
- `GET /openapi.json` returns an OpenAPI document, but that document currently describes only the bootstrap evaluate/rankings endpoints and is behind the actual football lane route surface.

### Scoring and grade outputs

FORGE currently has two scoring paths:

1. **Bootstrap scaffold path**
   - `POST /api/forge/evaluate`
   - `POST /api/forge/rankings`
   - Uses generic player fields such as projected minutes, recent fantasy points, salary, injury status, and tags.
   - Produces weighted components: `opportunity`, `recent_form`, `salary_efficiency`, and `availability`.
   - Explicitly reports scaffold status and warns that legacy parity is deferred.

2. **Football lane path**
   - `POST /api/forge/evaluate-football`
   - `POST /api/forge/rankings-football`
   - `POST /api/forge/rankings-football/from-artifact`
   - Consumes `ForgeWeeklyPlayerInput/v1` records.
   - Produces weighted components: `opportunity`, `efficiency`, `environment`, and `stability`.
   - Produces `overall`, `tier`, `rankHint`, confidence score/label, deterministic reasons, metadata, source metadata, and warnings.
   - Marks source metadata as `provider: tiber-forge-football-lane`, `parityStatus: football-lane-v1`, `specAlignment: tiber-data-forge-ingestion-v1`, and `inputContract: ForgeWeeklyPlayerInput/v1`.

### Ranking/tier logic

- Ranking is deterministic: sort by descending `score.overall`, then stable tie-break by `playerId`.
- Tiers are currently shared by bootstrap and football scoring:
  - `core` for scores `>= 82`;
  - `strong` for scores `>= 68`;
  - `neutral` for scores `>= 50`;
  - `avoid` below `50`.
- Football confidence labels are deterministic from coverage, data-confidence hints, support flags, availability state, injury/practice inputs, active projection, and role volatility.

### Artifact inputs/outputs

- Artifact ingestion reads local JSON from disk and validates arrays of `ForgeWeeklyPlayerInput` records.
- The artifact rankings endpoint supports explicit lanes:
  - `sample`;
  - `derived_qb`;
  - `derived_skill`.
- `derived_skill` can optionally resolve week-specific paths using `FORGE_WEEKLY_DERIVED_SKILL_ARTIFACT_PATH_TEMPLATE` with `{season}` and `{week}` placeholders.
- Local fixture coverage includes upstream-compatible sample artifacts and derived weekly skill-position artifacts for 2024 weeks 1 through 6.
- The artifact endpoint returns normal rankings plus warnings that name the artifact lane and ingestion path and state that the path is disk-backed rather than live TIBER-Data parity.

### Existing UI

No product UI is currently present in this repository. There are no frontend app files, page routes, design system components, or player-grade card views. The current user-facing surface is JSON over HTTP plus local inspection scripts.

### Build/start/test scripts

Current package scripts:

- `npm run build` -> TypeScript compile with `tsc -p tsconfig.json`.
- `npm run dev` -> `node --experimental-strip-types src/server.ts`.
- `npm start` -> `node dist/server.js`.
- `npm test` -> build, then Node test runner over `tests/*.test.js`.

The declared engine requirement is Node `>=22.0.0`.

### Inspection utility

- `scripts/inspect-football-artifact-grades.js` can inspect artifact-backed football rankings from fixtures or local `../TIBER-Data` artifacts.
- The script supports `--artifact-kind`, `--season`, `--week`, `--limit`, `--artifact-path`, `--artifact-template`, and `--use-real-tiber-data` style workflows.
- This is useful for operator sanity checks, but it is not a product UI or stable public API.

### Test coverage

Current tests cover:

- app route behavior for health/readiness/bootstrap/football/artifact paths;
- bootstrap deterministic scoring and rankings fixtures;
- football lane deterministic output, component behavior, confidence behavior, ranking behavior, and calibration checks;
- `ForgeWeeklyPlayerInput` validation and artifact ingestion failure modes;
- artifact path resolution in the inspection utility;
- fixture parity and relative-order guarantees.

This is solid for a narrow deterministic lane, but not yet sufficient for public standalone product trust because there is no read-only v1 product API contract, no UI tests, no deployment smoke test, no OpenAPI parity for football endpoints, and no fixture-mode production startup proof.

## 3. Gaps/blockers

### Product/API gaps

- No player search/list endpoint exists.
- No read-only `GET /players/:playerId/grade` endpoint exists.
- No canonical `GET /rankings` endpoint exists for latest artifact-backed grades.
- No `GET /artifacts/latest` endpoint exists.
- `GET /metadata` does not exist; `GET /` is a bootstrap metadata route but is not a stable product metadata contract.
- Current football endpoints are POST-oriented scoring endpoints and artifact execution endpoints, not a polished read-only product API.
- OpenAPI is stale for the football lane: it documents bootstrap evaluate/rankings but not `evaluate-football`, `rankings-football`, or `rankings-football/from-artifact`.
- Response contracts do not yet expose a product-grade input-gap section that clearly lists unavailable/null source fields per player.
- There is no stable artifact manifest contract describing latest season/week/source set/artifact path/checksum/build time.

### UI gaps

- No standalone web UI exists.
- No polished player grade cards exist.
- No player detail surface exists for component breakdown, provenance, uncertainty, and unavailable inputs.
- No artifact inspector page exists.
- No public methodology/scoring-docs screen exists.

### Deployment gaps

- Startup currently fails unless `FORGE_SERVICE_MODE=bootstrap-demo` is set.
- Default artifact paths point to `../TIBER-Data/...`, which may not exist on Railway.
- No Railway config file or documented Railway deployment profile exists.
- No production fixture-mode switch exists beyond manually configuring artifact paths to repository fixtures.
- No deploy-time smoke command is documented.
- The service has liveness/readiness routes, but readiness currently only reflects static initialization, not artifact availability or latest-grade cache health.
- No persistent storage or artifact download strategy is defined for standalone deploys.

### Contract/data gaps

- The adapter currently fills missing football input fields with defaults for scoring purposes. This keeps the lane runnable, but a trusted product surface must also report which inputs were unavailable so users do not mistake defaults for observed source truth.
- `opponent` defaults to `UNK` when missing. Product UI/API should preserve that as unknown/unavailable, not as a confident opponent identity.
- Current contract alignment says FORGE consumes `TIBER-Data`, `TIBER-Teamstate`, and `Role-and-opportunity` outputs, but the runtime is still local artifact/disk based and does not have a stable live ingestion or artifact registry handshake.
- Role/environment/insulation notes are not a first-class output. Some environment inputs are scored, but there is no structured notes array for role context, team environment, insulation, source provenance, or input gaps.
- No checksum/version manifest verifies that a rendered grade card corresponds to a specific artifact build.

### Public-facing stale/experimental surface

- Bootstrap NBA/generic endpoints are useful scaffolding but should not be marketed as player-grade FORGE v1.
- The OpenAPI document title/description still presents a bootstrap service and should not be the public contract until refreshed.
- `bootstrap-demo` mode naming is honest for development but undermines standalone product positioning if exposed to end users as the only production mode.
- Local `../TIBER-Data` path defaults are convenient for co-located development but should not be treated as production behavior.
- Inspection scripts should remain operator tooling, not public-facing UX.

## 4. Minimal standalone FORGE v1

The v1 goal should be a small, read-only, deterministic product surface over stable player-grade artifacts. It should not add fake projections or mutate source truth.

### Target user-facing capabilities

- **Player search/list**
  - List players available in the latest loaded artifact.
  - Filter by season, week, team, position, tier, confidence label, and source set where available.
  - Search by player name and canonical `playerId`.

- **Polished player grade cards**
  - Player identity: name, team, opponent if known, position, season, week, source set, as-of timestamp.
  - Score: overall numeric grade and tier.
  - Confidence: deterministic confidence label/score with a short explanation.
  - Rank context: rank and deterministic tie-break policy.
  - Clear warnings when an artifact, source field, or interpretation is incomplete.

- **Pillar breakdown**
  - Show the current football pillars: opportunity, efficiency, environment, stability.
  - Show weight, score, and plain-language reason for each pillar.
  - Show input fields used by each pillar, preserving unavailable/null where the input artifact did not provide real values.

- **Role/environment/insulation notes where available**
  - Role notes should come from contract-backed role/opportunity fields only.
  - Environment notes should come from contract-backed team/game context only.
  - Insulation notes should be rendered only when supplied by a contract or explicitly derived from named available inputs.
  - If notes are unavailable, render `null` or `unavailable`; do not synthesize narrative certainty.

- **Uncertainty/guardrails**
  - Show missing fields and quality flags per player.
  - Show source contract, source set, as-of timestamp, season, week, and scoring version.
  - Distinguish low confidence due to missing inputs from low confidence due to negative player signal.

- **Artifact export**
  - Export latest rankings/grades as JSON.
  - Include artifact metadata, source set, season/week, scoring version, input contract, warnings, and checksum once available.

- **No fake projections**
  - Do not create fantasy point projections unless an upstream contract supplies them or a future FORGE contract explicitly defines projection semantics.
  - Current FORGE v1 should be a grade/signal/ranking engine, not a projections engine.

### Minimal implementation sequence after this docs PR

1. Define a read-only grade artifact shape that wraps current `EvaluateResponse`/`RankingsResponse` with artifact metadata and input-gap reporting.
2. Add fixture-mode artifact loading for standalone deploys using repository fixtures when live artifacts are unavailable.
3. Add GET endpoints over a loaded latest artifact without changing scoring math.
4. Refresh OpenAPI to match football v1 routes.
5. Add a small UI consuming those GET endpoints.
6. Add smoke tests for product API and fixture-mode Railway startup.

## 5. Proposed v1 API

All proposed v1 endpoints should be read-only for the first standalone deploy. No write/mutation path is required.

### `GET /health`

Purpose: liveness probe.

Suggested response fields:

```json
{
  "status": "ok",
  "timestamp": "2026-05-10T00:00:00.000Z"
}
```

Readiness and artifact health can remain separate so a process can be alive while latest artifact loading is degraded.

### `GET /metadata`

Purpose: stable service/product metadata.

Suggested response fields:

```json
{
  "service": "tiber-forge",
  "purpose": "deterministic fantasy signal/scoring engine",
  "version": "0.2.0",
  "mode": "fixture",
  "scoringLane": "football-lane-v1",
  "inputContract": "ForgeWeeklyPlayerInput/v1",
  "deterministic": true,
  "latestArtifact": {
    "season": 2024,
    "week": 6,
    "sourceSetId": "td-weekly-2024-w06-skill-offline-derived-v1",
    "asOf": "...",
    "checksum": null
  },
  "warnings": []
}
```

### `GET /players`

Purpose: list/search players in the latest artifact-backed grade set.

Suggested query parameters:

- `q` - search by player name or id;
- `season`;
- `week`;
- `team`;
- `position`;
- `tier`;
- `confidence`;
- `limit`;
- `offset`.

Suggested response fields:

```json
{
  "count": 4,
  "players": [
    {
      "playerId": "...",
      "playerName": "...",
      "team": "...",
      "opponent": "...",
      "position": "RB",
      "season": 2024,
      "week": 6,
      "score": 72.4,
      "tier": "strong",
      "confidenceLabel": "medium"
    }
  ],
  "artifact": {
    "sourceSetId": "...",
    "asOf": "..."
  }
}
```

### `GET /players/:playerId/grade`

Purpose: player-grade detail card API.

Suggested response fields:

- player identity;
- score/tier/rank;
- pillar breakdown;
- confidence;
- role/environment/insulation notes where available;
- input gaps;
- quality flags;
- source metadata;
- artifact metadata;
- warnings.

Important behavior:

- Return `404` when the player is not in the loaded artifact.
- Return unavailable values as `null` or `unavailable`; do not backfill product copy from scoring defaults.

### `GET /rankings`

Purpose: latest deterministic ranking set.

Suggested query parameters:

- `season`;
- `week`;
- `position`;
- `team`;
- `tier`;
- `confidence`;
- `limit`;
- `offset`;
- `includeBreakdown=true|false`.

Suggested response fields:

- rankings array;
- rank, player, score, tier, confidence;
- optional component breakdown;
- artifact metadata;
- deterministic tie-break rule;
- warnings.

### `GET /artifacts/latest`

Purpose: latest artifact export/inspection.

Suggested response fields:

- artifact metadata: source set, season, week, as-of timestamp, loaded-at timestamp, input contract, scoring version, checksum if available;
- record counts by position/tier/confidence;
- full rankings/grades or a link/URI if exported separately;
- warnings and input-gap summary.

This endpoint should become the stable handoff target for `TIBER-Fantasy`/Observatory once grade artifacts are versioned.

## 6. Proposed v1 UI

A small standalone UI should be read-only and explain-first. It should make deterministic scoring inspectable rather than hiding uncertainty.

### Home / engine status

- Service status and readiness.
- Current mode: fixture/local/live-artifact once defined.
- Latest artifact summary: season, week, source set, as-of timestamp, loaded-at timestamp, input contract, scoring version, checksum if available.
- Warnings and degraded-state banner if artifact loading failed or fixture mode is active.

### Player grades

- Search and filterable player table/cards.
- Columns/cards: rank, player, team, opponent, position, score, tier, confidence, key warnings.
- Filters: position, team, tier, confidence, source set, season/week.
- Clear label that scores are deterministic grades, not projections.

### Player detail

- Polished grade card with score, tier, confidence, rank, and provenance.
- Pillar breakdown for opportunity/efficiency/environment/stability with weights and reasons.
- Input evidence panel grouped by pillar.
- Input gaps panel showing missing/unavailable fields and quality flags.
- Role/environment/insulation notes only when contract-backed.
- Artifact and scoring metadata.

### Artifact inspector

- Artifact records, source set, season/week, as-of timestamp, count by position, quality flags summary, and checksum if available.
- Raw JSON viewer/download for latest grade artifact.
- Operator-only copy should be clear that artifacts are read-only.

### Methodology / scoring docs

- Explain purpose and boundaries: deterministic signal grade, not source truth and not fake projection.
- Explain tiers, confidence, pillars, tie-break behavior, and input-gap handling.
- Link to architecture docs and contract specs.
- State upstream ownership: `TIBER-Data` for source/provenance truth, `TIBER-Teamstate` for interpreted team environment, and `Role-and-opportunity` for player-role context.

## 7. Deployment path

### Railway readiness checklist

- **Build command:** `npm ci && npm run build`.
- **Start command:** `npm start`.
- **Node version:** Node `>=22.0.0`.
- **Health check path:** `/health`.
- **Readiness path:** `/ready` initially, then a stronger artifact-aware readiness endpoint or expanded `/ready` payload.
- **No write/mutation paths required for v1:** all v1 endpoints should be read-only.
- **No database required for v1:** load a configured artifact into memory or read a fixture artifact at startup.
- **Fixture mode if live data unavailable:** configure artifact paths to repository fixture files or package a known safe fixture artifact for Railway deploy validation.
- **OpenAPI parity:** update `/openapi.json` before treating the service as public.
- **Smoke test:** after deploy, call `/health`, `/ready`, `/metadata`, `/players`, `/rankings`, and `/artifacts/latest`.

### Required/current env vars

Current hard requirement:

- `FORGE_SERVICE_MODE=bootstrap-demo`.

Current optional env vars with defaults:

- `PORT` - defaults to `3000`.
- `LOG_LEVEL` - defaults to `info`; allowed values are `debug`, `info`, `warn`, `error`.
- `FORGE_WEEKLY_INPUT_ARTIFACT_PATH` - defaults to a local `../TIBER-Data` sample artifact path.
- `FORGE_WEEKLY_DERIVED_QB_ARTIFACT_PATH` - defaults to a local `../TIBER-Data` derived QB artifact path.
- `FORGE_WEEKLY_DERIVED_SKILL_ARTIFACT_PATH` - defaults to a local `../TIBER-Data` derived skill artifact path.
- `FORGE_WEEKLY_DERIVED_SKILL_ARTIFACT_PATH_TEMPLATE` - optional path template with `{season}` and `{week}`.

Recommended v1 env additions or replacements:

- `FORGE_RUNTIME_MODE=fixture|artifact` or rename away from `bootstrap-demo` for product deployments.
- `FORGE_LATEST_ARTIFACT_PATH` for the loaded read-only latest grade/input artifact.
- `FORGE_FIXTURE_MODE=true|false` or `FORGE_ARTIFACT_SOURCE=fixture|local|remote`.
- `FORGE_PUBLIC_BASE_URL` if UI/API self-links are needed.
- `FORGE_CORS_ORIGINS` if Observatory or `TIBER-Fantasy` consume from browsers.

### Local file dependency plan

- Short term: support explicit fixture artifact paths inside the repository for deploy smoke tests.
- Medium term: support a stable artifact mount/download path independent of sibling `../TIBER-Data` checkout assumptions.
- Long term: consume a governed artifact registry or object storage manifest emitted by `TIBER-Data`, while preserving read-only behavior in FORGE.

## 8. Trust rules

Standalone FORGE v1 should follow these rules before any public surface is considered trusted:

1. **No invented player data.** Do not fabricate usage, route data, PPR outcomes, injury truth, player identity, source metadata, team context, role context, or projections.
2. **Unavailable values render as unavailable/null.** Scoring defaults may keep math deterministic internally, but product UI/API must tell users which source fields were missing.
3. **Preserve source/season/week where known.** Every grade should carry source set, season, week, as-of timestamp, input contract, scoring version, and artifact metadata where available.
4. **Scoring explanation must show input gaps.** Reasons should not imply observed evidence when the field was defaulted or unavailable.
5. **FORGE must not silently patch missing TIBER-Data contracts.** If upstream contract fields are missing, the output should expose uncertainty and quality flags, not pretend richer upstream support exists.
6. **No fake projections.** Grade/tier/rank are deterministic FORGE outputs; projected fantasy points should remain absent unless explicitly contract-backed in a future scope.
7. **Proxy labels stay explicit.** Proxy participation should never be labeled as true proprietary route participation.
8. **Artifact-backed claims require provenance.** A rendered player card should be traceable to a specific artifact/source set and scoring version.
9. **Deterministic tie-breaks are documented.** Ranking order should remain reproducible and explainable.
10. **Warnings are first-class.** Fixture mode, missing live data, quality flags, and unsupported inputs should be visible in API/UI, not hidden in logs.

## 9. Integration with Observatory

Observatory should eventually route fantasy implication notes to FORGE when FORGE exposes stable player-grade artifacts and read-only grade endpoints.

Recommended integration path:

1. **FORGE publishes stable latest-grade artifacts.** The artifact includes player grades, component breakdowns, confidence, source set, season/week, scoring version, warnings, and input gaps.
2. **Observatory consumes FORGE as a read-only signal source.** Observatory should not duplicate FORGE scoring math or infer missing grade fields.
3. **Observatory links notes to FORGE provenance.** Fantasy implication notes should reference `playerId`, `season`, `week`, `sourceSetId`, and grade artifact version/checksum where available.
4. **Observatory separates narrative from scoring.** Observatory may summarize implications, but score/tier/confidence should remain FORGE-owned values.
5. **Missing FORGE data remains explicit.** If no stable grade exists for a player/week, Observatory should display unavailable state instead of synthesizing a fantasy implication from partial context.
6. **TIBER-Fantasy can consume the same artifact/API.** Once stable, both Observatory and `TIBER-Fantasy` should reference the same FORGE player-grade artifacts to avoid divergent product math.

### Suggested contract between FORGE and Observatory

Minimum fields Observatory should require before rendering FORGE-backed fantasy implication notes:

- `playerId`;
- `playerName`;
- `team`;
- `position`;
- `season`;
- `week`;
- `sourceSetId`;
- `asOf`;
- `score.overall`;
- `score.tier`;
- `confidence.label` and `confidence.score`;
- component scores/reasons;
- input gaps and quality flags;
- artifact/scoring version.

Until those fields are stable, Observatory should treat FORGE as an internal/operator signal rather than a public product dependency.

## Recommended roadmap summary

### Phase 0: docs and audit (this PR)

- Document current capabilities, gaps, trust rules, and standalone target surface.
- Keep runtime unchanged.

### Phase 1: product API contract without model changes

- Add latest-artifact loader/cache with fixture mode.
- Add `GET /metadata`, `GET /players`, `GET /players/:playerId/grade`, `GET /rankings`, and `GET /artifacts/latest` over current scoring outputs.
- Add explicit input-gap reporting.
- Update OpenAPI and tests.

### Phase 2: minimal UI

- Add read-only UI screens: Home/status, Player grades, Player detail, Artifact inspector, Methodology.
- Keep UI honest about fixture mode, unavailable data, and non-projection semantics.

### Phase 3: deploy hardening

- Add Railway docs/config if desired.
- Add artifact-aware readiness.
- Add deploy smoke tests.
- Remove assumptions that production has a sibling `../TIBER-Data` checkout.

### Phase 4: Observatory/Fantasy integration

- Publish stable grade artifacts or read-only endpoints.
- Route Observatory fantasy implication notes and `TIBER-Fantasy` player-grade displays to FORGE-owned outputs.
- Keep source truth and role/team interpretation ownership upstream.
