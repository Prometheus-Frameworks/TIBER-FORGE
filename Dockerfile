# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install all dependencies (including devDependencies for TypeScript compiler)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and compile TypeScript → dist/
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Verify the compilation produced output — fail fast if dist/ is empty
RUN if [ -z "$(ls -A dist 2>/dev/null)" ]; then \
      echo "ERROR: dist/ is empty after build — TypeScript compilation produced no output" >&2; \
      exit 1; \
    fi && \
    echo "dist/ contents:" && ls -lR dist

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output from the build stage
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["npm", "run", "start"]
