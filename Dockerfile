# Build stage
FROM node:20-alpine AS builder

# Build tools for native modules like better-sqlite3
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json ./

RUN npm ci

# Copy app source
COPY . .

# Build Next app
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Persistent SQLite location
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
