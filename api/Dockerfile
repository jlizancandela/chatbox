# syntax=docker/dockerfile:1

# La imagen de la API: build con pnpm, runtime con solo las dependencias de
# producción, un usuario sin privilegios y un healthcheck contra /health.
#
# El runtime no compila nada: `dist/` entra ya compilado desde la etapa de build, y las
# dependencias de producción se instalan aparte para que el compilador y los tests no
# viajen dentro.

# --- Build -----------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build:ts

# --- Dependencias de producción --------------------------------------------------
FROM node:24-alpine AS prod-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# --- Runtime ---------------------------------------------------------------------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=7000
WORKDIR /app
RUN corepack enable
# `--chown` deja los ficheros con el usuario sin privilegios desde el principio: no
# hace falta un `chown -R` sobre `node_modules` al final, que tarda una eternidad.
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node package.json pnpm-lock.yaml ./
# Las migraciones se aplican al arrancar, así que su directorio viaja en la imagen.
COPY --chown=node:node database ./database
# El corpus que se ingiere: el comando `ingest` lo lee desde aquí.
COPY --chown=node:node ingest ./ingest
COPY --chown=node:node --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh
USER node
EXPOSE 7000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 7000) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["./docker-entrypoint.sh"]
