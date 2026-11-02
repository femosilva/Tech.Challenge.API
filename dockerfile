FROM oven/bun:1.4.3 AS base
WORKDIR /app

# Dependências de produção. O Bun também instala a CLI do Prisma aqui (ela entra como peer de
# @prisma/client), então a imagem final não é enxuta, mas é a que foi testada rodando a API.
FROM base AS dependencias-producao
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

# Todas as dependências: o `postinstall` gera o client do Prisma em src/.../generated, que fica fora do Git.
FROM base AS completo
COPY package.json bun.lock prisma.config.ts ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

# Job de migrations e seed. A CLI do Prisma precisa de openssl para falar com o Postgres.
FROM completo AS migrate
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
CMD ["sh", "-c", "bunx --bun prisma migrate deploy && bun scripts/seed.ts"]

# Imagem final da API.
FROM base AS app
ENV NODE_ENV=production
COPY --from=dependencias-producao --chown=bun:bun /app/node_modules ./node_modules
COPY --from=completo --chown=bun:bun /app/package.json /app/tsconfig.json ./
COPY --from=completo --chown=bun:bun /app/src ./src
USER bun
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD ["bun", "-e", "fetch(`http://localhost:${process.env.PORT ?? 3000}/health`).then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["bun", "src/index.ts"]
