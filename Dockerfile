# ---------- MFS Stock v4 ----------
FROM node:20-alpine

LABEL maintainer="Meyroll DADJO HOUEGBAN" \
      description="MFS Stock — gestion de stock multi-magasins" \
      version="4.0.0"

WORKDIR /app

# Outils de compilation pour les modules natifs (bcrypt, sqlite3)
RUN apk add --no-cache --virtual .build python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev && apk del .build

COPY backend ./backend
COPY frontend ./frontend

# Exécution sans les droits root
RUN mkdir -p /app/data && chown -R node:node /app
USER node

ENV NODE_ENV=production PORT=3001 DB_STORAGE=/app/data/mfs_stock.sqlite
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "backend/server.js"]
