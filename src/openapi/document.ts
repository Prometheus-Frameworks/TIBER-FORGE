export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'TIBER FORGE Bootstrap Service',
    version: '0.1.0',
    description: 'Bootstrap standalone external FORGE service exposing canonical evaluate and rankings contracts.'
  },
  paths: {
    '/': {
      get: { summary: 'Service metadata' }
    },
    '/health': {
      get: { summary: 'Liveness probe' }
    },
    '/ready': {
      get: { summary: 'Readiness probe' }
    },
    '/openapi.json': {
      get: { summary: 'OpenAPI document' }
    },
    '/api/forge/evaluate': {
      post: { summary: 'Evaluate a single player using the canonical FORGE contract' }
    },
    '/api/forge/rankings': {
      post: { summary: 'Rank multiple players using deterministic bootstrap logic' }
    }
  }
} as const;
