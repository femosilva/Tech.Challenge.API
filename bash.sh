#!/usr/bin/env bash
# Reconciliação da camada de infraestrutura. Pode rodar mais de uma vez.
set -e
P=src/infrastructure/persistence
T=tests/unit/infrastructure/persistence
I=tests/integration/persistence

# 1. client gerado fora do Git e da cobertura (o `bun install` o regenera no postinstall)
if git ls-files --error-unmatch $P/generated/client.ts >/dev/null 2>&1; then
  git rm -r --cached --quiet $P/generated
fi
grep -qxF "/$P/generated" .gitignore || printf '\n# prisma: client gerado\n/%s/generated\n' "$P" >> .gitignore
perl -pi -e 's#coveragePathIgnorePatterns = \["tests/\*\*"\]#coveragePathIgnorePatterns = ["tests/**", "src/infrastructure/persistence/generated/**"]#' bunfig.toml

# 2. testes no lugar certo
mkdir -p $T/cadastro $I/cadastro
[ -f $T/cliente.mapper.test.ts ] && git mv $T/cliente.mapper.test.ts $T/cadastro/
[ -f $T/cliente.adapters.test.ts ] && git mv $T/cliente.adapters.test.ts $I/cadastro/
perl -pi -e "s#'\.\./\.\./\.\./integration/support/banco-de-teste'#'../../support/banco-de-teste'#" $I/cadastro/cliente.adapters.test.ts

# 3. imports por alias nos adapters do Cliente
perl -pi -e "s#from '\.\./\.\./generated/client'#from '\@infrastructure/persistence/generated/client'#; s#from '\.\./\.\./prisma-client'#from '\@infrastructure/persistence/prisma-client'#; s#from '\.\./\.\./traduzir-erro-banco'#from '\@infrastructure/persistence/traduzir-erro-banco'#" $P/cadastro/cliente/*.ts

echo "ok"; git status --short
