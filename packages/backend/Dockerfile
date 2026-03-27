# Stage 1: Install dependencies
FROM node:20-alpine AS deps

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./

# Copy package.json files for all workspace packages
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (including devDependencies for building)
RUN pnpm install --frozen-lockfile

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Build the application
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/backend/node_modules ./packages/backend/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source files
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

# Build shared package first, then backend
WORKDIR /app/packages/shared
RUN pnpm build 2>/dev/null || true

WORKDIR /app/packages/backend
RUN pnpm build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: Production runner
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nestjs

WORKDIR /app

ENV NODE_ENV=production

# Copy workspace manifests needed for pnpm to resolve the workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/shared/dist  ./packages/shared/dist

# Copy any extra runtime assets (e.g. email templates if bundled separately)
# COPY --from=builder /app/packages/backend/templates ./packages/backend/templates

# Switch to non-root user
USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/v1/health || exit 1

WORKDIR /app/packages/backend

CMD ["node", "dist/main"]
