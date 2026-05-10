# TIBER-Data → TIBER-FORGE Weekly Ingestion Spec (Phase 1)

> May alignment note: after the May TIBER-Data milestone, this spec should be read as a FORGE-side ingestion/grading boundary. `TIBER-Data` owns governed source/provenance truth; `TIBER-Teamstate` owns team-environment interpretation; `Role-and-opportunity` owns player-role interpretation; FORGE consumes those artifacts/contracts and grades fantasy signal without mutating upstream artifacts or fabricating missing context.

## A) Decision summary

- **TIBER-FORGE must evolve from bootstrap scaffold into the fantasy signal grading layer for football rankings.**
- **TIBER-Data should be the canonical governed source/provenance truth for source-backed usage/PPR evidence, roster identity, source metadata, GOBLIN research candidates, play-caller PROE scaffold/input validation, and Receiving Role Integrity proxy scaffolds.**
- **TIBER-Teamstate should supply interpreted team-environment context, and Role-and-opportunity should supply interpreted player-role context.**
- **TIBER-Fantasy should consume FORGE outputs as the cockpit and should not own long-term ranking math.**
- **This PR is spec-first only**: no live ingestion implementation, no runtime scoring replacement, no product rewiring.

## B) Current state (as of this PR)

### TIBER-FORGE current reality

TIBER-FORGE is currently a service bootstrap with deterministic scaffold behavior, not parity-grade live football ranking math:

- current mode is explicitly `bootstrap-demo`
- source metadata marks outputs as `parityStatus: "bootstrap-scaffold"`
- scoring/reasons/confidence are deterministic placeholder heuristics
- no canonical upstream TIBER-Data ingestion path exists yet

### Ecosystem split reality after May alignment

The intended ownership split is now explicit, even while runtime integration remains incremental:

- TIBER-Data proves what happened by governing source/provenance truth, source-backed usage and PPR evidence, roster identity, GOBLIN research candidates, play-caller PROE scaffold/input validation, and Receiving Role Integrity / route participation proxy scaffold.
- TIBER-Teamstate explains the team environment and supplies interpreted team context.
- Role-and-opportunity explains player role and supplies interpreted player-role context.
- GOBLIN finds ugly-output legitimate-signal candidates for inspection/research context.
- TIBER-FORGE grades fantasy signal from governed inputs and interpreted context.
- TIBER-Fantasy becomes the cockpit for presentation, filtering, comparison, and product-facing explanation.

**Conclusion:** the next architecture step is to keep the weekly input contract explicit about source truth, interpreted context, proxy labels, and read-only research context before deeper ranking math implementation.

## C) Target architecture

```text
TIBER-Data + TIBER-Teamstate + Role-and-opportunity  --->  TIBER-FORGE  --->  TIBER-Fantasy
(governed truth + interpreted football context)             (fantasy signal grading) (cockpit)
```

### Responsibility boundaries

#### TIBER-Data responsibilities

Own governed source/provenance truth, including:

- source adapters, source freshness, and source metadata
- source-backed usage evidence and PPR outcomes
- roster identity and cross-id mapping
- weekly stats normalization
- injury/status normalization if sourced upstream
- GOBLIN research candidates as governed candidate artifacts
- play-caller PROE scaffold/input validation
- Receiving Role Integrity / route participation proxy scaffold, clearly labeled as proxy participation rather than proprietary route truth
- export/contract versioning for downstream consumers

#### TIBER-FORGE responsibilities

Own fantasy signal grading intelligence, including:

- scoring formulas and weighting policies over supplied inputs
- penalties/boosts and tier derivation
- deterministic fallback behavior that exposes missing upstream features without fabricating them
- confidence scoring logic
- explanation primitives and reason generation
- evaluation/rankings outputs and deterministic execution behavior
- read-only inspection of GOBLIN candidates only when a contract explicitly provides them as context

#### TIBER-Teamstate responsibilities

Own team-environment interpretation, including game/team context, team tendencies, and interpreted environmental signals that can be consumed by FORGE when contract-backed.

#### Role-and-opportunity responsibilities

Own player-role interpretation, including role and opportunity context that can be consumed by FORGE when contract-backed.

#### GOBLIN responsibilities

Own candidate discovery for ugly-output legitimate-signal research. GOBLIN candidates are not direct FORGE scoring inputs by default.

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
- Missing values are allowed for some fields in phase 1; TIBER-FORGE must apply deterministic fallback rules without fabricating usage, routes, PPR outcomes, identity, source metadata, team-environment context, or player-role context.
- Phase 1 should keep the schema narrow and avoid full feature-store overdesign.

## E) Ownership rules: what Data supplies vs what FORGE computes

### Supplied by TIBER-Data (canonical inputs)

- player identity + cross-id mapping
- weekly raw stats and derived upstream feature columns
- source-backed usage and PPR outcome fields
- roster identity and cross-id mapping
- upstream freshness/provenance and quality indicators
- Receiving Role Integrity proxy outputs only when source-backed and explicitly labeled as proxy participation
- contract version metadata

### Computed by TIBER-FORGE (fantasy signal grading intelligence)

- score components, weighted totals, alpha/final score
- tier labels and ranking order
- penalties/boosts and fallback math
- confidence score and confidence label
- explanation primitives / machine-readable reason payloads

### Supplied by TIBER-Teamstate and Role-and-opportunity (interpreted context)

- team-environment context from TIBER-Teamstate
- player-role context from Role-and-opportunity
- no proprietary route claims unless an upstream contract explicitly proves and labels the field

### Read-only GOBLIN context

- GOBLIN candidates may be consumed for inspection only unless a future scoring contract explicitly promotes them to scoring inputs.
- Candidate discovery must not silently alter FORGE ranking weights, tiers, confidence, or reason generation.

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

## H) Guardrails and explicit deferrals (out of scope for this PR/spec)

- no fabricated usage, routes, PPR outcomes, player identity, source metadata, team context, or player-role context
- no proprietary route claims
- no mutation of TIBER-Data artifacts
- no treating GOBLIN candidates as direct scoring inputs by default
- no calling proxy participation true route participation
- no scoring/ranking changes from this docs-only alignment

- claiming full legacy parity
- completing all modes (dynasty/ROS/best-ball) immediately
- runtime Teamstate weighting rollout
- frontend rewiring in TIBER-Fantasy
- broad multi-repo runtime implementation
- perfect feature-store architecture
- full DB unification across repos

## Implementation status for this PR

- ✅ Spec/documentation only.
- ✅ No runtime scoring behavior changes.
- ✅ No evaluate/rankings contract-breaking API changes.
- ✅ No fake claim that live TIBER-Data → TIBER-FORGE ingestion is already implemented.
