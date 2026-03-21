# TIBER-FORGE

Standalone external FORGE service bootstrap for TIBER-Fantasy.

## Purpose

This repository is the first service-ready implementation step in the FORGE externalization plan. It establishes the canonical standalone HTTP contract surface that TIBER-Fantasy can later consume through an adapter, while intentionally **not** attempting full parity with the legacy in-repo FORGE module yet.

> **Important assumption:** the referenced transition spec file, `TIBER-Fantasy/docs/architecture/FORGE_EXTERNALIZATION_TRANSITION_SPEC.md`, was not present in the workspace available to this task. This bootstrap implementation therefore follows the contract and migration intent described in the task prompt itself and clearly labels all placeholder behavior.

## Current bootstrap scope

This PR provides:

- typed canonical FORGE request/response contracts
- runtime validation with explicit request/response validators
- `POST /api/forge/evaluate` for single-player evaluation
- `POST /api/forge/rankings` for deterministic multi-player rankings
- deterministic bootstrap/demo scoring logic
- health, readiness, and config validation
- Railway-friendly build/start scripts
- focused HTTP and contract tests

## Non-goals for this bootstrap

This repository intentionally does **not** yet include:

- full legacy FORGE feature parity
- a database or persistence layer
- integration changes back into `TIBER-Fantasy`
- any frontend or UI
- adapter wiring inside the consuming application

## Service behavior

### Bootstrap/demo scoring

The scoring service uses deterministic, explicitly temporary heuristics based on:

- projected minutes
- recent fantasy points
- salary efficiency
- injury availability

Responses include warnings and source metadata that make the bootstrap status explicit.

### Canonical endpoints

- `GET /` – service metadata
- `GET /health` – liveness probe
- `GET /ready` – readiness probe
- `GET /openapi.json` – lightweight OpenAPI document
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

## Example response shape

```json
{
  "requestId": "req-eval-1",
  "playerId": "player-1",
  "score": 88.46,
  "tier": "core",
  "rankingHint": 13,
  "components": [
    {
      "name": "opportunity",
      "weight": 0.35,
      "score": 91.2,
      "reason": "Projected minutes (34) drive bootstrap opportunity scoring."
    }
  ],
  "confidence": {
    "score": 0.98,
    "label": "high"
  },
  "reasons": [
    "Demo Guard receives a bootstrap FORGE score of 88.46."
  ],
  "source": {
    "provider": "tiber-forge-bootstrap",
    "version": "0.1.0",
    "mode": "bootstrap-demo",
    "deterministic": true,
    "parityStatus": "bootstrap-scaffold",
    "generatedAt": "2026-03-21T19:00:00Z"
  },
  "warnings": [
    "Bootstrap/demo scoring only; legacy FORGE parity is intentionally deferred."
  ]
}
```

## Railway readiness

This repository is Railway-friendly via standard Node scripts:

- build: `npm run build`
- start: `npm start`

Railway can supply `PORT`, while the service requires `FORGE_SERVICE_MODE=bootstrap-demo` during this bootstrap phase.

## Future path

The intended next steps after this bootstrap are:

1. validate the canonical contract against the missing transition spec and consuming adapter expectations
2. replace placeholder heuristics with parity-focused scoring behavior incrementally
3. add adapter-backed integration from `TIBER-Fantasy` into this standalone service
4. introduce more precise source metadata and provenance as real scoring inputs land
