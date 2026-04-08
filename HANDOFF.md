# TIBER-FORGE — Working Handoff

## Repo purpose in one sentence

TIBER-FORGE deterministically evaluates canonical football inputs and artifact-backed weekly records.

## Current agent workflow

Typical loop:
1. run a real-player or fixture sanity check
2. identify whether the issue is upstream or downstream
3. Lamar scopes the smallest honest fix
4. Codex implements
5. Claude audits when needed
6. rerun the same inspection path

## Standard debug sequence

When output looks suspicious:
1. confirm which artifact path was actually read
2. inspect the underlying row semantics
3. compare components: opportunity, efficiency, environment, stability, confidence
4. decide whether the issue belongs in TIBER-Data or TIBER-FORGE
5. change one layer only
6. rerun the same check

## If a mistake or uncertainty appears

First call:
- current artifact file
- inspection script output
- scoring code
- tests

If still unclear:
- Lamar decides ownership of the problem
- Claude audits if the calibration smells too broad

## Handoff note format

Every handoff should state:
- active lane (`sample`, `derived_qb`, `derived_skill`)
- artifact used
- observed problem
- owning repo
- next allowed move

Example:
- Active lane: `derived_skill`
- Artifact: 2024 week 6 real TIBER-Data artifact
- Observed problem: confidence compressed too tightly
- Owning repo: TIBER-FORGE
- Next allowed move: narrow confidence/stability calibration only
