FROM node:22-alpine AS base
WORKDIR /app

# ── API ──────────────────────────────────────────
FROM base AS api-deps
COPY api/package.json ./
RUN apk add --no-cache python3 make g++ \
  && npm install --omit=dev

FROM base AS api
COPY --from=api-deps /app/node_modules ./node_modules
COPY api/ ./
EXPOSE 5174
CMD ["node", "server.js"]

# ── Frontend ─────────────────────────────────────
FROM base AS frontend-deps
COPY package.json ./
RUN npm install

FROM base AS frontend
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]
