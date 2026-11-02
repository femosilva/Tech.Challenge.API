#   migrate job de execução única: aplica as migrations e semeia os usuários de demonstração
#   app     (padrão, último estágio) a API

FROM oven/bun:1.4.3 AS base
WORKDIR /app

# Instala as dependências e copia o código. O `postinstall` gera o client do Prisma em src/.../generated,
# que fica fora do Git. O Bun também instala a CLI do Prisma como peer de @prisma/client, então um
# `--production` separado não deixaria a imagem menor.
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
COPY --from=completo --chown=bun:bun /app/node_modules ./node_modules
COPY --from=completo --chown=bun:bun /app/package.json /app/tsconfig.json ./
COPY --from=completo --chown=bun:bun /app/src ./src
USER bun
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
CMD ["bun", "-e", "fetch(`http://localhost:${process.env.PORT ?? 3000}/health`).then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["bun", "src/index.ts"]
