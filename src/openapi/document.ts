const playerSchema = {
  type: 'object',
  required: ['playerId', 'playerName', 'team', 'opponent', 'position', 'injuryStatus', 'tags'],
  properties: {
    playerId: { type: 'string' },
    playerName: { type: 'string' },
    team: { type: 'string' },
    opponent: { type: 'string' },
    position: { type: 'string' },
    salary: { type: 'integer' },
    projectedMinutes: { type: 'number' },
    recentFantasyPoints: { type: 'number' },
    injuryStatus: { type: 'string', enum: ['healthy', 'questionable', 'doubtful', 'out'] },
    tags: { type: 'array', items: { type: 'string' } }
  }
} as const;

const contextSchema = {
  type: 'object',
  required: ['slateId', 'slateDate', 'sport', 'site', 'contestType', 'mode'],
  properties: {
    slateId: { type: 'string' },
    slateDate: { type: 'string', format: 'date-time' },
    sport: { type: 'string' },
    site: { type: 'string' },
    contestType: { type: 'string', enum: ['cash', 'tournament', 'simulation'] },
    mode: { type: 'string', enum: ['bootstrap-demo'] }
  }
} as const;

const sourceSchema = {
  type: 'object',
  required: ['provider', 'version', 'mode', 'deterministic', 'parityStatus', 'specAlignment', 'generatedAt'],
  properties: {
    provider: { type: 'string', enum: ['tiber-forge-bootstrap'] },
    version: { type: 'string' },
    mode: { type: 'string', enum: ['bootstrap-demo'] },
    deterministic: { type: 'boolean', enum: [true] },
    parityStatus: { type: 'string', enum: ['bootstrap-scaffold'] },
    specAlignment: { type: 'string', enum: ['pr72-transition'] },
    generatedAt: { type: 'string', format: 'date-time' }
  }
} as const;

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'TIBER FORGE Bootstrap Service',
    version: '0.2.0',
    description: 'Bootstrap standalone external FORGE service exposing transition-aligned evaluate and rankings contracts.'
  },
  components: {
    schemas: {
      EvaluateRequest: {
        type: 'object',
        required: ['player', 'context'],
        properties: {
          requestId: { type: 'string' },
          player: playerSchema,
          context: contextSchema
        }
      },
      RankingsRequest: {
        type: 'object',
        required: ['players', 'context'],
        properties: {
          requestId: { type: 'string' },
          players: { type: 'array', minItems: 1, maxItems: 100, items: playerSchema },
          context: contextSchema,
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          includeExplanations: { type: 'boolean', default: true }
        }
      },
      EvaluateResponse: {
        type: 'object',
        required: ['requestId', 'player', 'score', 'confidence', 'reasons', 'metadata', 'source', 'warnings'],
        properties: {
          requestId: { type: 'string' },
          player: {
            type: 'object',
            required: ['playerId', 'playerName', 'team', 'opponent', 'position'],
            properties: {
              playerId: { type: 'string' },
              playerName: { type: 'string' },
              team: { type: 'string' },
              opponent: { type: 'string' },
              position: { type: 'string' },
              salary: { type: 'integer' }
            }
          },
          score: {
            type: 'object',
            required: ['overall', 'tier', 'rankHint', 'components'],
            properties: {
              overall: { type: 'number' },
              tier: { type: 'string', enum: ['core', 'strong', 'neutral', 'avoid'] },
              rankHint: { type: 'integer' },
              components: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['key', 'label', 'weight', 'score', 'reason'],
                  properties: {
                    key: { type: 'string', enum: ['opportunity', 'recent_form', 'salary_efficiency', 'availability'] },
                    label: { type: 'string' },
                    weight: { type: 'number' },
                    score: { type: 'number' },
                    reason: { type: 'string' }
                  }
                }
              }
            }
          },
          confidence: {
            type: 'object',
            required: ['score', 'label', 'deterministic', 'reason'],
            properties: {
              score: { type: 'number' },
              label: { type: 'string', enum: ['low', 'medium', 'high'] },
              deterministic: { type: 'boolean', enum: [true] },
              reason: { type: 'string' }
            }
          },
          reasons: { type: 'array', items: { type: 'string' } },
          metadata: {
            type: 'object',
            required: ['slateId', 'slateDate', 'sport', 'site', 'contestType', 'mode', 'injuryStatus', 'tags', 'bootstrap'],
            properties: {
              slateId: { type: 'string' },
              slateDate: { type: 'string', format: 'date-time' },
              sport: { type: 'string' },
              site: { type: 'string' },
              contestType: { type: 'string', enum: ['cash', 'tournament', 'simulation'] },
              mode: { type: 'string', enum: ['bootstrap-demo'] },
              injuryStatus: { type: 'string', enum: ['healthy', 'questionable', 'doubtful', 'out'] },
              tags: { type: 'array', items: { type: 'string' } },
              bootstrap: { type: 'boolean', enum: [true] }
            }
          },
          source: sourceSchema,
          warnings: { type: 'array', items: { type: 'string' } }
        }
      },
      RankingsResponse: {
        type: 'object',
        required: ['requestId', 'count', 'rankings', 'metadata', 'source', 'warnings'],
        properties: {
          requestId: { type: 'string' },
          count: { type: 'integer' },
          rankings: {
            type: 'array',
            items: {
              allOf: [
                { $ref: '#/components/schemas/EvaluateResponse' },
                {
                  type: 'object',
                  required: ['rank'],
                  properties: {
                    rank: { type: 'integer' }
                  }
                }
              ]
            }
          },
          metadata: {
            type: 'object',
            required: ['totalCandidates', 'returnedCount', 'limitApplied', 'includeExplanations'],
            properties: {
              totalCandidates: { type: 'integer' },
              returnedCount: { type: 'integer' },
              limitApplied: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
              includeExplanations: { type: 'boolean' }
            }
          },
          source: sourceSchema,
          warnings: { type: 'array', items: { type: 'string' } }
        }
      },
      ErrorEnvelope: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['category', 'code', 'message', 'traceId'],
            properties: {
              category: { type: 'string', enum: ['VALIDATION_ERROR', 'CONFIG_ERROR', 'NOT_READY', 'NOT_FOUND', 'INTERNAL_ERROR'] },
              code: { type: 'string' },
              message: { type: 'string' },
              details: {},
              traceId: { type: 'string' }
            }
          }
        }
      }
    }
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
      post: {
        summary: 'Evaluate a single player using the transition-aligned FORGE contract',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/EvaluateRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Evaluation result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/EvaluateResponse' }
              }
            }
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorEnvelope' }
              }
            }
          }
        }
      }
    },
    '/api/forge/rankings': {
      post: {
        summary: 'Rank multiple players using deterministic transition-aligned bootstrap logic',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RankingsRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Rankings result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RankingsResponse' }
              }
            }
          },
          '400': {
            description: 'Validation failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorEnvelope' }
              }
            }
          }
        }
      }
    }
  }
} as const;
