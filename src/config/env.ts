export interface AppConfig {
  FORGE_SERVICE_MODE: 'bootstrap-demo';
  PORT: number;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  FORGE_WEEKLY_INPUT_ARTIFACT_PATH: string;
  FORGE_WEEKLY_DERIVED_QB_ARTIFACT_PATH: string;
  FORGE_WEEKLY_DERIVED_SKILL_ARTIFACT_PATH: string;
}

function parsePort(rawPort: string | undefined): number {
  if (rawPort === undefined) {
    return 3000;
  }
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('Invalid PORT. Expected an integer between 1 and 65535.');
  }
  return port;
}

function parseLogLevel(rawLevel: string | undefined): AppConfig['LOG_LEVEL'] {
  const logLevel = rawLevel ?? 'info';
  if (logLevel === 'debug' || logLevel === 'info' || logLevel === 'warn' || logLevel === 'error') {
    return logLevel;
  }
  throw new Error('Invalid LOG_LEVEL. Expected one of: debug, info, warn, error.');
}

function parseArtifactPath(rawPath: string | undefined): string {
  const artifactPath = rawPath ?? '../TIBER-Data/data/gold/forge/forge_weekly_player_input_2025_w12.sample.json';
  if (artifactPath.trim().length === 0) {
    throw new Error('Invalid FORGE_WEEKLY_INPUT_ARTIFACT_PATH. Expected a non-empty local file path.');
  }
  return artifactPath;
}

function parseDerivedQbArtifactPath(rawPath: string | undefined): string {
  const artifactPath = rawPath ?? '../TIBER-Data/data/gold/forge/forge_weekly_player_input_2024_w01.qb_offline_fixture.derived.json';
  if (artifactPath.trim().length === 0) {
    throw new Error('Invalid FORGE_WEEKLY_DERIVED_QB_ARTIFACT_PATH. Expected a non-empty local file path.');
  }
  return artifactPath;
}

function parseDerivedSkillArtifactPath(rawPath: string | undefined): string {
  const artifactPath = rawPath ?? '../TIBER-Data/data/gold/forge/forge_weekly_player_input_2024_w01.skill_positions_offline_fixture.derived.json';
  if (artifactPath.trim().length === 0) {
    throw new Error('Invalid FORGE_WEEKLY_DERIVED_SKILL_ARTIFACT_PATH. Expected a non-empty local file path.');
  }
  return artifactPath;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (env.FORGE_SERVICE_MODE !== 'bootstrap-demo') {
    throw new Error('Missing or invalid FORGE_SERVICE_MODE. Expected FORGE_SERVICE_MODE=bootstrap-demo.');
  }

  return {
    FORGE_SERVICE_MODE: 'bootstrap-demo',
    PORT: parsePort(env.PORT),
    LOG_LEVEL: parseLogLevel(env.LOG_LEVEL),
    FORGE_WEEKLY_INPUT_ARTIFACT_PATH: parseArtifactPath(env.FORGE_WEEKLY_INPUT_ARTIFACT_PATH),
    FORGE_WEEKLY_DERIVED_QB_ARTIFACT_PATH: parseDerivedQbArtifactPath(env.FORGE_WEEKLY_DERIVED_QB_ARTIFACT_PATH),
    FORGE_WEEKLY_DERIVED_SKILL_ARTIFACT_PATH: parseDerivedSkillArtifactPath(env.FORGE_WEEKLY_DERIVED_SKILL_ARTIFACT_PATH)
  };
}
