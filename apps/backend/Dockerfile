# Multi-stage Dockerfile for Fastify backend
# Optimized for production with minimal image size

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma

# Install production dependencies only
RUN npm ci --only=production && \
    npm run db:generate

# Build backend TypeScript
FROM base AS builder
WORKDIR /app

# Copy all source files
COPY . .
COPY --from=deps /app/node_modules ./node_modules

# Build TypeScript to JavaScript
RUN npm run build

# Production image - minimal size
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 fastify

# Copy built files and dependencies
COPY --from=builder --chown=fastify:nodejs /app/dist ./dist
COPY --from=deps --chown=fastify:nodejs /app/node_modules ./node_modules
COPY --chown=fastify:nodejs package*.json ./
COPY --chown=fastify:nodejs prisma ./prisma

# Switch to non-root user
USER fastify

# Expose backend port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["npm", "start"]
