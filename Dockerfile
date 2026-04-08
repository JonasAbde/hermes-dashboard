FROM node:22-alpine AS base
WORKDIR /app

# ── API ──────────────────────────────────────────────────────────────────
FROM base AS api-deps
COPY api/package.json ./
RUN apk add --no-cache python3 make g++ curl \
  && npm install --omit=dev

FROM base AS api
COPY --from=api-deps /app/node_modules ./node_modules
COPY api/ ./
EXPOSE 5174

# Readiness probe: curl hits /api/health every 30s, 3 retries, 5s timeout
# start-period 10s gives the app time to warm up before first check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -sf http://localhost:5174/api/health || exit 1

CMD ["node", "server.js"]

# ── Frontend ─────────────────────────────────────────────────────────────
FROM base AS frontend-deps
COPY package.json ./
RUN npm install

FROM base AS frontend
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY . .
ARG API_URL=http://host.docker.internal:5174
ENV API_URL=$API_URL
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]
