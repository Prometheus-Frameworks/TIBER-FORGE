# TIBER-FORGE

Standalone external FORGE service bootstrap for TIBER-Fantasy.

## Purpose

This repository is the first service-ready implementation step in the FORGE externalization plan. This PR tightens the bootstrap implementation so the service contracts, field names, response envelopes, source metadata, and bootstrap outputs align more closely with the PR72 transition contract referenced by the externalization plan, while still **not** attempting full legacy FORGE parity.

> **Important assumption:** the referenced transition spec file, `TIBER-Fantasy/docs/architecture/FORGE_EXTERNALIZATION_TRANSITION_SPEC.md`, was not present anywhere in the local `/workspace` during this task. The alignment work in this repo therefore uses the task requirements themselves as the closest available source of truth and marks every scaffold-only behavior explicitly.

## What now matches the transition contract more closely

This revision aligns the bootstrap surface around:

- explicit evaluate and rankings response envelopes
- nested `player`, `score`, `confidence`, `metadata`, and `source` structures
- stable component keys: `opportunity`, `recent_form`, `salary_efficiency`, `availability`
- stable score fields: `overall`, `tier`, `rankHint`, `components`
- stable confidence fields: `score`, `label`, `deterministic`, `reason`
- explicit source metadata including `specAlignment: "pr72-transition"`
- stable rankings metadata including `totalCandidates`, `returnedCount`, `limitApplied`, and `includeExplanations`
- stable error envelopes with category/code/message/details/traceId fields
- deterministic bootstrap-generated outputs keyed from request data rather than runtime randomness

## Bootstrap honesty

This service still returns **bootstrap scaffold** values, not parity-grade legacy FORGE results.

Recent parity-oriented improvements in this repo are intentionally narrow: the bootstrap scorer now leans more heavily on opportunity and availability, applies a clearer minutes penalty for weak-opportunity cases, uses stronger low-availability penalties, and keeps confidence behavior explicit and deterministic. Those changes are meant to reduce obvious fixture drift without claiming full legacy FORGE reimplementation.

The following fields are deterministic placeholders today:

- component scores
- total score and tier assignment
- confidence scoring
- explanation strings
- rankings ordering

Those fields are intentionally deterministic and explicitly labeled through:

- `source.parityStatus = "bootstrap-scaffold"`
- `source.specAlignment = "pr72-transition"`
- `confidence.deterministic = true`
- `metadata.bootstrap = true`
- warning messages that state parity remains deferred

## Current bootstrap scope

This PR provides:

- typed transition-aligned FORGE request/response contracts
- runtime validation for request, response, and error envelopes
- `POST /api/forge/evaluate` for single-player evaluation
- `POST /api/forge/rankings` for deterministic multi-player rankings
- deterministic bootstrap/demo scoring logic with explicit placeholder semantics
- parity-oriented heuristic tuning for elite, stable mid-tier, volatile, weak-opportunity, and low-availability fixture-style scenarios
- health, readiness, and config validation
- OpenAPI documentation with request/response schemas
- focused HTTP and contract tests
- internal parity regression fixtures and ordering assertions to guard against future heuristic drift

## Architecture specs

- `docs/architecture/TIBER_DATA_TO_FORGE_INGESTION_SPEC.md` - spec-first boundary and candidate contract for canonical weekly TIBER-Data -> TIBER-FORGE ingestion (no runtime integration in this PR).


## Initial football lane (ForgeWeeklyPlayerInput v1)

TIBER-FORGE now includes a **small football-specific deterministic lane** that accepts canonical `ForgeWeeklyPlayerInput`-shaped payloads and maps them through a narrow adapter into FORGE-shaped evaluate/rankings outputs.

- New lane endpoints: `POST /api/forge/evaluate-football` and `POST /api/forge/rankings-football`
- Uses football-oriented components (`opportunity`, `efficiency`, `environment`, `stability`) with deterministic scoring
- Source metadata explicitly marks this as `football-lane-v1` with `inputContract: "ForgeWeeklyPlayerInput/v1"`
- Existing bootstrap demo endpoints and behavior remain intact
- No DB, no live ingestion pipeline, and no full parity claim in this step

### Contract-boundary correction (post-PR6)

PR6 introduced the football lane. A follow-up boundary correction now keeps that lane intact while aligning the public football input contract more closely to canonical `TIBER-Data` `ForgeWeeklyPlayerInput/v1` semantics (including optional `opponent`, descriptive `dataConfidenceHint`, and adapter-side normalization of `activeProjection`).

### Artifact-driven football operator path (first upstream fuel line)

TIBER-FORGE can now ingest a canonical sample `ForgeWeeklyPlayerInput` artifact file from disk (defaulting to the upstream handoff path `../TIBER-Data/data/gold/forge/forge_weekly_player_input_2025_w12.sample.json`, override via `FORGE_WEEKLY_INPUT_ARTIFACT_PATH`) and run the existing deterministic football rankings lane through `POST /api/forge/rankings-football/from-artifact`.

This is an operator/development ingestion path only: no live network pull from TIBER-Data, no DB, and no full production parity claim. The direct football request path and bootstrap lane remain available. Local fallback artifacts used in this repo are test fixtures, not canonical upstream sources; compatibility tests target an upstream-semantic mirror fixture.


## Non-goals

This repository intentionally does **not** yet include:

- full legacy FORGE feature parity
- a database or persistence layer
- integration changes back into `TIBER-Fantasy`
- any frontend or UI
- adapter wiring inside the consuming application

## Canonical endpoints

- `GET /` – service metadata
- `GET /health` – liveness probe
- `GET /ready` – readiness probe
- `GET /openapi.json` – OpenAPI document
- `POST /api/forge/evaluate` – evaluate one player
- `POST /api/forge/rankings` – return ranked player outputs

## Configuration

The service validates environment variables at startup.

Required:

- `FORGE_SERVICE_MODE=bootstrap-demo`

Optional:

- `PORT=3000`
- `LOG_LEVEL=info`

If `FORGE_SERVICE_MODE` is missing or invalid, startup fails immediately.

## Local development

### Build

```bash
npm run build
```

### Run tests

```bash
FORGE_SERVICE_MODE=bootstrap-demo npm test
```

The test suite includes an internal fixture-driven parity regression pack (`tests/fixtures/forgeParityFixtures.ts`) that locks in deterministic ordering, penalty, and confidence expectations for core bootstrap scenarios.

### Run locally

```bash
FORGE_SERVICE_MODE=bootstrap-demo node --experimental-strip-types src/server.ts
```

### Build and start

```bash
npm run build
FORGE_SERVICE_MODE=bootstrap-demo npm start
```

## Example evaluate request

```json
{
  "requestId": "req-eval-1",
  "player": {
    "playerId": "player-1",
    "playerName": "Demo Guard",
    "team": "AAA",
    "opponent": "BBB",
    "position": "PG",
    "salary": 8200,
    "projectedMinutes": 34,
    "recentFantasyPoints": 42,
    "injuryStatus": "healthy",
    "tags": ["starter"]
  },
  "context": {
    "slateId": "slate-2026-03-21-main",
    "slateDate": "2026-03-21T19:00:00Z",
    "sport": "nba",
    "site": "draftkings",
    "contestType": "tournament",
    "mode": "bootstrap-demo"
  }
}
```

## Example evaluate response

```json
{
  "requestId": "req-eval-1",
  "player": {
    "playerId": "player-1",
    "playerName": "Demo Guard",
    "team": "AAA",
    "opponent": "BBB",
    "position": "PG",
    "salary": 8200
  },
  "score": {
    "overall": 90.52,
    "tier": "core",
    "rankHint": 10,
    "components": [
      {
        "key": "opportunity",
        "label": "Opportunity",
        "weight": 0.4,
        "score": 86,
        "reason": "Projected minutes (34) anchor the deterministic bootstrap opportunity component."
      }
    ]
  },
  "confidence": {
    "score": 0.99,
    "label": "high",
    "deterministic": true,
    "reason": "Confidence is a deterministic bootstrap heuristic derived from availability, projected minutes, recent form, and explicit fragility penalties; it remains scaffold logic rather than full legacy parity."
  },
  "reasons": [
    "Demo Guard receives a bootstrap FORGE score of 90.52."
  ],
  "metadata": {
    "slateId": "slate-2026-03-21-main",
    "slateDate": "2026-03-21T19:00:00Z",
    "sport": "nba",
    "site": "draftkings",
    "contestType": "tournament",
    "mode": "bootstrap-demo",
    "injuryStatus": "healthy",
    "tags": ["starter"],
    "bootstrap": true
  },
  "source": {
    "provider": "tiber-forge-bootstrap",
    "version": "0.2.0",
    "mode": "bootstrap-demo",
    "deterministic": true,
    "parityStatus": "bootstrap-scaffold",
    "specAlignment": "pr72-transition",
    "generatedAt": "2026-03-21T19:00:00Z"
  },
  "warnings": [
    "Bootstrap scaffold only; fields align to the PR72 transition contract, but legacy FORGE parity remains intentionally deferred."
  ]
}
```

## Rankings behavior

`POST /api/forge/rankings` returns the same aligned evaluation envelope for each ranking entry, plus a top-level rankings metadata block.

`includeExplanations=false` is supported in bootstrap mode by suppressing component and explanation detail while keeping the core ranking contract deterministic and explicit.

## Error behavior

Validation, readiness, not-found, and unexpected failures all return a stable envelope:

```json
{
  "error": {
    "category": "VALIDATION_ERROR",
    "code": "INVALID_REQUEST_BODY",
    "message": "Request validation failed.",
    "details": ["player.playerId must be a non-empty string."],
    "traceId": "trace-validation_error-invalid_request_body"
  }
}
```

## Intentional parity gaps remaining

The following are still deferred to later PRs:

- full parity-grade scoring logic and calibration beyond the current fixture-oriented heuristic tuning
- real data provenance and upstream source attribution
- spec verification against the unavailable upstream markdown file
- adapter wiring from `TIBER-Fantasy`
- deeper batch semantics beyond deterministic rankings response support
- richer health/readiness diagnostics beyond simple bootstrap probes

## Railway readiness

This repository is Railway-friendly via standard Node scripts:

- build: `npm run build`
- start: `npm start`

Railway can supply `PORT`, while the service requires `FORGE_SERVICE_MODE=bootstrap-demo` during this bootstrap phase.
