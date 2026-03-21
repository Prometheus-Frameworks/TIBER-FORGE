export interface AppConfig {
  FORGE_SERVICE_MODE: 'bootstrap-demo';
  PORT: number;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (env.FORGE_SERVICE_MODE !== 'bootstrap-demo') {
    throw new Error('Missing or invalid FORGE_SERVICE_MODE. Expected FORGE_SERVICE_MODE=bootstrap-demo.');
  }

  return {
    FORGE_SERVICE_MODE: 'bootstrap-demo',
    PORT: parsePort(env.PORT),
    LOG_LEVEL: parseLogLevel(env.LOG_LEVEL)
  };
}
