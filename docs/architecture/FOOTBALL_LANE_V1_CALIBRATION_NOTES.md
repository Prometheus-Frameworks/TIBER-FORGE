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
