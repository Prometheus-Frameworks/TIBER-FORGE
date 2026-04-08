# TIBER-FORGE

`TIBER-FORGE` is a standalone, contract-driven FORGE service bootstrap focused on a deterministic football lane.

It is intentionally early and constrained: useful for local development, artifact-based evaluation, and sanity-checking score outputs, but **not** a production-complete system.

## What this repo is

- A deterministic FORGE service surface with typed contracts and runtime validation.
- A football lane that can score and rank canonical `ForgeWeeklyPlayerInput/v1` records.
- An artifact-driven operator path that can read local weekly artifacts and produce inspectable grades.

## What this repo is not

- Not full legacy FORGE parity.
- Not live-ingestion backed (no live pull from `TIBER-Data`).
- Not final production-grade model truth.
- Not the `TIBER-Fantasy` product UI or product-facing integration surface.

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
