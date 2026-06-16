# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first for layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL deps (includes TypeScript, ts-node for build)
RUN npm ci

# Generate Prisma client against the schema
RUN npx prisma generate

# Copy source and compile
COPY tsconfig.json ./
COPY src ./src/
RUN npx tsc

# ─── Production runtime ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production deps + regenerate Prisma client in prod image
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
