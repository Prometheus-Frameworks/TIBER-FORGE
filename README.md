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
- health, readiness, and config validation
- OpenAPI documentation with request/response schemas
- focused HTTP and contract tests

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
    "overall": 88.46,
    "tier": "core",
    "rankHint": 13,
    "components": [
      {
        "key": "opportunity",
        "label": "Opportunity",
        "weight": 0.35,
        "score": 91.2,
        "reason": "Projected minutes (34) drive the deterministic bootstrap opportunity component."
      }
    ]
  },
  "confidence": {
    "score": 0.98,
    "label": "high",
    "deterministic": true,
    "reason": "Confidence is a deterministic bootstrap heuristic derived from availability, projected minutes, and simple tag presence."
  },
  "reasons": [
    "Demo Guard receives a bootstrap FORGE score of 88.46."
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

- parity-grade scoring logic and calibration
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
