# Football Lane v1 Initial Calibration Notes

## Scope of this pass

This is the first calibration pass after canonical `ForgeWeeklyPlayerInput/v1` artifact ingestion was wired. It keeps the current deterministic football lane and public contracts unchanged.

## What the lane was doing before this PR

- Four weighted components (`opportunity`, `efficiency`, `environment`, `stability`) produced the final score.
- Opportunity and efficiency math used mostly position-agnostic coefficients.
- Stability and confidence were deterministic and based on injury/practice/coverage hints, but quality flags had no stability impact and confidence penalties were relatively soft for risky profiles.

## Obvious first-pass weaknesses found

1. **Position-generic opportunity/efficiency math** could over/under-credit some profiles (for example, route/catch features applied similarly across positions).
2. **Game-script bumps were too strong for first pass** (especially pass-catcher negative-script boosts).
3. **Fragility penalties were too soft in confidence**, allowing questionable or low-stability profiles to retain optimistic confidence labels.
4. **`qualityFlags` were ignored in component scoring**, despite being part of the canonical artifact payload.

## What changed in this PR

- Added **position-aware opportunity and efficiency formulas** (QB vs RB vs WR/TE weighting split) while keeping deterministic scoring.
- Softened **game-script adjustments** to reduce one-field overreaction.
- Rebalanced **stability penalties** (role volatility, risky/inactive projection, practice), and added a bounded quality-flag penalty.
- Tightened **confidence math** by adding explicit penalties for role volatility, risky active projection, and poor practice status.
- Added one focused fixture (`rb-volume-1`) and updated ranking assertions to verify volume-heavy / low-efficiency behavior is handled more honestly.

## Explicitly deferred

- Full legacy FORGE parity.
- New upstream fields or live ingestion expansion.
- Team-state integration and broader modeling architecture changes.
- Any API contract changes to evaluate/rankings endpoints.

## Small follow-up environment calibration (this PR)

### Weakness observed

Environment was still somewhat compressed because implied team total did most of the lifting while defense/script/spread context had limited room to differentiate similar projections.

### What changed (still using the same four environment inputs)

- Kept environment inputs unchanged: `impliedTeamTotal`, `opponentDefenseTier`, `expectedGameScript`, `spread`.
- Modestly rebalanced environment scoring so implied total remains primary but less dominant (`2.1x` -> `1.85x`).
- Slightly strengthened defense-tier deltas (especially weak vs elite separation).
- Made spread adjustment position-sensitive with conservative caps (RB > QB > WR/TE sensitivity).
- Slightly widened script split across positions (RB positive/negative and pass-catcher negative-script behavior).

### Why this is intentionally modest

- Environment remains one weighted component (no contract changes, no feature additions, no live ingestion changes).
- Coefficient changes are narrow and interpretable; the lane remains deterministic and bounded.
- Existing weekly-factory derived skill (2024 W1-W6) behavior remains sanity-checked rather than broadly re-tuned.

### Explicitly deferred

- Any richer team/game context beyond the current four environment fields.
- New upstream contracts or `TIBER-Data` schema additions.
- Full-model recalibration or production-parity claims.

## Narrow confidence/stability interpretation follow-up (post upstream variance fix)

### What still looked off after `TIBER-Data` row-level variance improved

- Real-player rows started varying correctly on `featureCoverage`, `roleVolatility`, and quality flags, but football-lane confidence still clustered too tightly in a low band.
- Labels remained too pessimistic for healthier rows with meaningfully better support.

### What this calibration changed (and only this)

- Modestly reweighted football confidence to use the current inputs more effectively (`featureCoverage`, `dataConfidenceHint`, support-flag count, volatility, practice, active projection, injury status).
- Reduced excessive compression by softening some penalties and adding a small expected-active confidence adjustment while keeping deterministic bounds.
- Nudged confidence labels slightly (`high >= 0.72`, `medium >= 0.38`) so improved-support rows are not auto-labeled low.
- Minor stability interpretation tweak: include a small bounded data-confidence contribution and slightly soften quality-flag/volatility drag.

### Still deferred

- No API or contract changes.
- No `TIBER-Data` or artifact-path logic changes.
- No opportunity/efficiency/environment rewrite.
