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

# Create www-data user/group with Debian/Ubuntu-compatible UID/GID
RUN addgroup -g 33 -S www-data \
    && adduser -S -D -H -u 33 -G www-data www-data \
    && mkdir -p /app/data \
    && chown -R www-data:www-data /app

COPY --from=builder --chown=www-data:www-data /app/public ./public
COPY --from=builder --chown=www-data:www-data /app/.next/standalone ./
COPY --from=builder --chown=www-data:www-data /app/.next/static ./.next/static

USER www-data

EXPOSE 3000

CMD ["node", "server.js"]
