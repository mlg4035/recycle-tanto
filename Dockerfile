# Build stage
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN mkdir -p /app/data \
    && chown -R 33:33 /app

COPY --from=builder --chown=33:33 /app/public ./public
COPY --from=builder --chown=33:33 /app/.next/standalone ./
COPY --from=builder --chown=33:33 /app/.next/static ./.next/static

USER 33:33

EXPOSE 3000

CMD ["node", "server.js"]
