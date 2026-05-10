# TIBER-FORGE

`TIBER-FORGE` is a standalone, contract-driven fantasy signal grading layer focused on a deterministic football lane.

It is intentionally early and constrained: useful for local development, artifact-based evaluation, and sanity-checking score outputs, but **not** a production-complete system. FORGE sits downstream of governed source truth from `TIBER-Data`, team-environment interpretation from `TIBER-Teamstate`, and player-role interpretation from `Role-and-opportunity`; it grades fantasy relevance from those inputs rather than owning raw source truth or product presentation.

## What this repo is

- A deterministic FORGE service surface with typed contracts and runtime validation.
- A fantasy signal grading layer for football that can score and rank canonical `ForgeWeeklyPlayerInput/v1` records.
- An artifact-driven operator path that can read local weekly artifacts and produce inspectable grades.
- A downstream evaluator of governed source truth and interpreted football context.

## What this repo is not

- Not full legacy FORGE parity.
- Not live-ingestion backed (no live pull from `TIBER-Data`).
- Not final production-grade model truth.
- Not the owner of source-backed usage/PPR evidence, roster identity, GOBLIN research candidates, play-caller PROE scaffold/input validation, or Receiving Role Integrity proxy scaffolds.
- Not a place to fabricate missing usage, route, PPR, identity, source, team-environment, or player-role context.
- Not GOBLIN candidate discovery.
- Not the `TIBER-Fantasy` cockpit, product UI, or product-facing integration surface.

## System boundary after the May TIBER-Data milestone

- `TIBER-Data` proves what happened: governed source/provenance truth, source-backed usage and PPR outcomes, roster identity, source metadata, GOBLIN research candidates, play-caller PROE scaffold/input validation, and Receiving Role Integrity / route participation proxy scaffold.
- `TIBER-Teamstate` explains the team environment: game/team context, team tendencies, and team-environment interpretation consumed by downstream rankers.
- `Role-and-opportunity` explains player role: role and opportunity context used to interpret a player's football situation.
- `GOBLIN` finds ugly-output legitimate-signal candidates: candidates are inspection/research context, not default scoring inputs for FORGE.
- `TIBER-FORGE` grades fantasy signal: it consumes governed source truth and interpreted football context, then produces deterministic fantasy relevance grades, components, tiers, confidence labels, and explanations.
- `TIBER-Fantasy` becomes the cockpit: it presents, filters, compares, and explains FORGE outputs to users without owning the ranking math.

## Future input expectations

FORGE should expect upstream artifacts or contracts to provide these fields only when they are governed by the owning layer:

- source-backed usage evidence and PPR outcomes from `TIBER-Data`;
- roster identity and cross-id mapping from `TIBER-Data`;
- team-environment context from `TIBER-Teamstate`;
- player-role context from `Role-and-opportunity`;
- Receiving Role Integrity proxy outputs only when source-backed and clearly labeled as proxy participation;
- GOBLIN candidates as read-only inspection context unless a future scoring contract explicitly promotes them to scoring inputs.

## Guardrails

- Do not fabricate usage, routes, PPR outcomes, player identity, or source metadata.
- Do not make proprietary route claims or imply unavailable route data is true route participation.
- Do not mutate `TIBER-Data` artifacts; FORGE reads governed inputs and emits separate grades.
- Do not treat GOBLIN candidates as direct scoring inputs by default.
- Do not call proxy participation true route participation; label proxy participation explicitly.
- Do not change scoring/ranking semantics in docs-only alignment work.

## Agent operating files

- [`AGENTS.md`](AGENTS.md)
- [`TRUTH_SOURCES.md`](TRUTH_SOURCES.md)
- [`HANDOFF.md`](HANDOFF.md)

## Current artifact lanes (football artifact rankings)

`POST /api/forge/rankings-football/from-artifact` supports these explicit lanes:

- `sample`
- `derived_qb`
- `derived_skill`

For `derived_skill`, you can optionally provide `artifactWeek` in the request and drive weekly factory file resolution via `FORGE_WEEKLY_DERIVED_SKILL_ARTIFACT_PATH_TEMPLATE` (supports `{season}` and `{week}`).

Current weekly-factory season segment coverage in this repo is validated through **2024 W1–W6** for the `derived_skill` path.

## Deterministic football lane status

The football lane is deterministic and contract-driven. It is still early, but it now produces real artifact-backed grades that are practical to inspect.

Calibration has been modestly improved (still bounded and interpretable) using the same four existing environment inputs:

- `impliedTeamTotal`
- `opponentDefenseTier`
- `expectedGameScript`
- `spread`

## Local workflow

Install and run the core checks:

```bash
npm install
npm run build
npm test
```

## Optional inspection utility (real grade sanity check)

Use `scripts/inspect-football-artifact-grades.js` for quick human inspection of ranked outputs (overall, components, confidence, tier).

Preferred real-player sanity check for the `derived_skill` lane (uses local `../TIBER-Data` season-segment artifacts, no live ingestion):

```bash
npm run build
node scripts/inspect-football-artifact-grades.js \
  --artifact-kind derived_skill \
  --season 2024 \
  --week 6 \
  --limit 8 \
  --use-real-tiber-data
```

This is the easiest path for inspecting real player names from existing `TIBER-Data` W1–W6 season-segment artifacts (for example `forge_weekly_player_input_2024_w06.skill_offline_fixture.derived.json`) and cross-checking outputs against references such as Sleeper gamelogs.

Fixture-based inspection is still supported for controlled/local mirrors:

```bash
npm run build
FORGE_WEEKLY_DERIVED_SKILL_ARTIFACT_PATH_TEMPLATE=tests/fixtures/artifacts/forge_weekly_player_input_{season}_w{week}.skill_positions_offline_fixture.derived.json \
node scripts/inspect-football-artifact-grades.js --artifact-kind derived_skill --season 2024 --week 6 --limit 4
```

You can also provide an explicit one-off path (`--artifact-path`) or template (`--artifact-template`) without editing the script source.

This utility is for operator/developer sanity checks only. It does not change contracts, model logic, or ingestion boundaries.

## Configuration

Required:

- `FORGE_SERVICE_MODE=bootstrap-demo`

Optional:

- `PORT=3000`
- `LOG_LEVEL=info`
- `FORGE_WEEKLY_INPUT_ARTIFACT_PATH=../TIBER-Data/data/gold/forge/forge_weekly_player_input_2025_w12.sample.json`
- `FORGE_WEEKLY_DERIVED_QB_ARTIFACT_PATH=../TIBER-Data/data/gold/forge/forge_weekly_player_input_2024_w01.qb_offline_fixture.derived.json`
- `FORGE_WEEKLY_DERIVED_SKILL_ARTIFACT_PATH=../TIBER-Data/data/gold/forge/forge_weekly_player_input_2024_w01.skill_positions_offline_fixture.derived.json`
- `FORGE_WEEKLY_DERIVED_SKILL_ARTIFACT_PATH_TEMPLATE=../TIBER-Data/data/gold/forge/forge_weekly_player_input_{season}_w{week}.skill_positions_offline_fixture.derived.json`

## API surface (current)

- `GET /`
- `GET /health`
- `GET /ready`
- `GET /openapi.json`
- `POST /api/forge/evaluate`
- `POST /api/forge/rankings`
- `POST /api/forge/evaluate-football`
- `POST /api/forge/rankings-football`
- `POST /api/forge/rankings-football/from-artifact`

## Non-goals for this repo refresh

- No model recalibration work.
- No artifact lane behavior changes.
- No `TIBER-Data` changes.
- No `TIBER-Fantasy` changes.
- No doctrine expansion.
