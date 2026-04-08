# TIBER-FORGE — Truth Sources and Failure Boundaries

## Canonical truth sources for this repo

Highest authority:
1. `ForgeWeeklyPlayerInput` contract from TIBER-Data
2. local repo scoring/evaluation code
3. artifact-driven tests and inspection scripts
4. README and documented repo scope

## What counts as truth here

Truth means:
- the input contract
- the committed scoring logic
- the actual artifact being read
- deterministic test results
- explicit calibration notes

Truth does not mean:
- “this player is too good to score like that, so the math must be wrong”
- “we should make this score look better”
- “the input probably meant something else”

## Repo boundary

TIBER-FORGE owns:
- evaluation logic
- ranking logic
- confidence/stability interpretation
- deterministic inspection of artifact lanes

TIBER-FORGE does not own:
- canonical upstream contracts
- raw support expansion
- fake repairs to upstream data
- product-layer rendering decisions

## Fail-closed rules

If outputs look wrong:
1. inspect the artifact actually used
2. identify whether the issue is upstream semantics or downstream interpretation
3. fix only the layer that truly owns the problem

If a task requests broad model change:
- reduce to the narrowest honest calibration
- leave unrelated components alone

If a task tries to use unsupported artifact coverage:
- fail clearly
- state the supported coverage window

## Forbidden moves

- broad score rewrites disguised as “small calibration”
- compensating for bad artifacts by juicing confidence
- changing repo boundaries quietly
- hiding data-quality issues in downstream scoring language
