# TIBER-Data → TIBER-FORGE Weekly Ingestion Spec (Phase 1)

## A) Decision summary

- **TIBER-FORGE must evolve from bootstrap scaffold into the scoring brain for football rankings.**
- **TIBER-Data should be the canonical stat/feature source for FORGE inputs.**
- **TIBER-Fantasy should consume FORGE outputs and should not own long-term ranking math.**
- **This PR is spec-first only**: no live ingestion implementation, no runtime scoring replacement, no product rewiring.

## B) Current state (as of this PR)

### TIBER-FORGE current reality

TIBER-FORGE is currently a service bootstrap with deterministic scaffold behavior, not parity-grade live football ranking math:

- current mode is explicitly `bootstrap-demo`
- source metadata marks outputs as `parityStatus: "bootstrap-scaffold"`
- scoring/reasons/confidence are deterministic placeholder heuristics
- no canonical upstream TIBER-Data ingestion path exists yet

### Ecosystem split reality (transition still incomplete)

Based on current ecosystem documentation context and migration notes, the split is only partially realized:

- TIBER-Fantasy still documents transition-era coexistence between legacy/in-repo FORGE behavior and external FORGE migration path.
- TIBER-Data documents canonical contracts/governance direction, but does not yet define a concrete weekly FORGE player-feature contract that can be consumed as-is by TIBER-FORGE.
- TIBER-FORGE still documents bootstrap scaffolding and transition contract alignment, not a production football ingestion + scoring pipeline.

**Conclusion:** the next architecture step is to define a canonical weekly input contract from TIBER-Data into TIBER-FORGE before deeper ranking math implementation.

## C) Target architecture

```text
TIBER-Data  --->  TIBER-FORGE  --->  TIBER-Fantasy
(canonical)      (scoring brain)    (product consumer)
```

### Responsibility boundaries

#### TIBER-Data responsibilities

Own and publish deterministic upstream data/features/contracts for ranking builds, including:

- canonical player identity mappings
- weekly stat inputs and aggregated usage/efficiency/context features
- stable scope keys (season/week/asOf)
- provenance/freshness semantics and confidence-support metadata
- versioned contract definitions usable by downstream FORGE builds

#### TIBER-FORGE responsibilities

Own ranking computation semantics, including:

- scoring formulas and weighting policies
- penalties/boosts and tier derivation
- confidence scoring logic
- explanation primitives and reason generation
- evaluation/rankings outputs and deterministic execution behavior

#### TIBER-Fantasy responsibilities

Own product consumption and UX, including:

- ranking presentation and filtering
- comparison/research experience
- adapter/consumer wiring for FORGE outputs
- product-specific display transformations

## D) Candidate input contract for weekly FORGE ranking builds

Phase-1 contract target: **tight and practical** for skill positions (QB/RB/WR/TE).

### Record name

`ForgeWeeklyPlayerInput`

### Candidate shape (v0)

```ts
interface ForgeWeeklyPlayerInput {
  // identity fields
  playerId: string;              // canonical TIBER player id
  externalPlayerIds?: {
    gsisId?: string;
    pfrId?: string;
    sleeperId?: string;
  };
  playerName: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;

  // scope fields
  season: number;                // e.g. 2026
  week: number;                  // NFL week index
  asOf: string;                  // ISO timestamp used for build

  // usage / volume fields
  snaps?: number;
  snapShare?: number;            // 0..1
  routesRun?: number;
  routeParticipation?: number;   // 0..1
  rushAttempts?: number;
  targets?: number;
  redZoneTouches?: number;
  goalLineTouches?: number;

  // efficiency fields
  yardsPerRouteRun?: number;
  yardsPerCarry?: number;
  catchRate?: number;            // 0..1
  fantasyPointsPerOpportunity?: number;
  explosivePlayRate?: number;    // 0..1

  // team / context fields
  impliedTeamTotal?: number;
  spread?: number;
  paceProxy?: number;
  opponentDefenseTier?: 'elite' | 'strong' | 'neutral' | 'weak';
  expectedGameScript?: 'positive' | 'neutral' | 'negative';

  // stability / availability fields
  injuryStatus?: 'healthy' | 'questionable' | 'doubtful' | 'out';
  practiceParticipation?: 'full' | 'limited' | 'did_not_practice' | 'none';
  activeProjection?: 'expected_active' | 'risky' | 'expected_inactive';
  roleVolatility?: number;       // 0..1

  // provenance / freshness / confidence-support
  sourceUpdatedAt: string;       // ISO timestamp of latest upstream refresh
  sourceSetId: string;           // deterministic id for source bundle
  featureCoverage: number;       // 0..1 completeness indicator
  qualityFlags?: string[];       // upstream warnings/anomalies
  dataConfidenceHint?: number;   // 0..1 support signal for downstream confidence model
}
```

### Contract notes

- This contract is intentionally **input-only**. It does not include FORGE outputs (score/tier/reasons/confidence).
- Missing values are allowed for some fields in phase 1; TIBER-FORGE must apply deterministic fallback rules.
- Phase 1 should keep the schema narrow and avoid full feature-store overdesign.

## E) Ownership rules: what Data supplies vs what FORGE computes

### Supplied by TIBER-Data (canonical inputs)

- player identity + cross-id mapping
- weekly raw stats and derived upstream feature columns
- reusable context baselines and schedule/opponent context inputs
- upstream freshness/provenance and quality indicators
- contract version metadata

### Computed by TIBER-FORGE (ranking intelligence)

- score components, weighted totals, alpha/final score
- tier labels and ranking order
- penalties/boosts and fallback math
- confidence score and confidence label
- explanation primitives / machine-readable reason payloads

### Surfaced by TIBER-Fantasy (consumer layer)

- ranking presentation, formatting, sorting preferences
- comparison and research UX
- product-specific explanation rendering
- consumer adapters for FORGE ranking/evaluation endpoints

## F) Ingestion options (not final decision)

### 1) Read-only API from TIBER-Data

- **Pros:** clear ownership, online freshness, explicit auth + contract boundaries.
- **Cons:** runtime dependency and latency/caching complexity.

### 2) Exported artifacts/files (e.g., versioned JSON/Parquet)

- **Pros:** deterministic weekly builds, simple replay/debug, low coupling.
- **Cons:** freshness lag, artifact lifecycle/hosting overhead.

### 3) Shared DB/views

- **Pros:** direct access and flexible querying.
- **Cons:** tight coupling, governance risk, schema-drift blast radius.

### 4) Versioned contract package (schemas + validators)

- **Pros:** explicit compatibility guarantees and shared typing.
- **Cons:** packaging/release discipline required across repos.

### Phase-1 recommendation

Start with **exported weekly artifacts + versioned contract package** as the initial path:

- keeps weekly builds deterministic and auditable
- avoids immediate hard runtime coupling
- allows fast schema iteration with explicit versioning
- can later evolve to API pull once scoring behavior is trusted

## G) Minimum viable live-FORGE build path

1. **Define and publish v0 `ForgeWeeklyPlayerInput` contract** from TIBER-Data.
2. **Produce one weekly skill-position dataset artifact** (QB/RB/WR/TE) using that contract.
3. **Implement one deterministic adapter in TIBER-FORGE** that reads the contract shape and maps into internal scoring inputs.
4. **Run one replaceable football scoring path behind existing FORGE contracts** (no breaking API changes).
5. **Keep TIBER-Fantasy integration unchanged initially** until output trust/parity thresholds are acceptable.

This enables real math work to begin in FORGE using canonical upstream inputs without premature ecosystem rewiring.

## H) Explicit deferrals (out of scope for this PR/spec)

- claiming full legacy parity
- completing all modes (dynasty/ROS/best-ball) immediately
- Team State weighting rollout
- frontend rewiring in TIBER-Fantasy
- broad multi-repo runtime implementation
- perfect feature-store architecture
- full DB unification across repos

## Implementation status for this PR

- ✅ Spec/documentation only.
- ✅ No runtime scoring behavior changes.
- ✅ No evaluate/rankings contract-breaking API changes.
- ✅ No fake claim that live TIBER-Data → TIBER-FORGE ingestion is already implemented.
