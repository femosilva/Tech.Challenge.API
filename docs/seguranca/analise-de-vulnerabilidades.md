# Análise de vulnerabilidades

- **Data:** 01/11/2026
- **Versão analisada:** branch `development`, commit `<preencher com o hash da entrega>`
- **Escopo:** dependências (`bun.lock`), código da API (Presentation, Application e Infrastructure) e configuração de contêiner
- **Fora do escopo:** infraestrutura de hospedagem e vulnerabilidades da imagem base (ver V8)

## 1. Resumo dos achados

| # | Achado | Severidade | Situação |
|---|---|---|---|
| V1 | 7 vulnerabilidades em dependências transitivas (1 alta, 4 moderadas, 2 baixas) | Alta (no pacote) | Corrigido |
| V2 | Canal de tempo no login permite descobrir e-mails cadastrados (CWE-204 e CWE-208) | Média | Corrigido |
| V3 | Documentação carrega JavaScript de CDN sem versão fixa (CWE-829) | Baixa | Corrigido |
| V4 | Sem limite de tentativas no login (CWE-307) | Média | Risco aceito no MVP |
| V5 | Usuários de demonstração semeados com senhas conhecidas (CWE-798) | Baixa | Aceito para a demonstração |
| V6 | Sem cabeçalhos de segurança HTTP | Baixa | Aceito no MVP |
| V7 | Saldo de peça e total de orçamento acima do `Int` de 32 bits viram erro 500 (CWE-190) | Baixa | Pendente no domínio |
| V8 | Imagem de contêiner não escaneada | n/d | Executar o scanner (ver 5) |

## 2. Detalhe dos achados

### V1. Dependências transitivas vulneráveis

`bun audit` encontrou 7 vulnerabilidades em dois pacotes:

| Pacote (versão) | Severidade | Advisory |
|---|---|---|
| lodash 4.17.21 | alta | GHSA-r5fr-rjxr-66jc (injeção de código via `_.template`) |
| lodash 4.17.21 | moderada | GHSA-xxjr-mmjv-4gpg e GHSA-f23m-r3pf-42rh (poluição de protótipo em `_.unset` e `_.omit`) |
| fast-uri 3.1.8 | moderada | GHSA-w74x-v6f9-j3xg (URI scheme spoofing) e GHSA-wjr9-j795-jxcr (host confusion) |
| fast-uri 3.1.8 | baixa | GHSA-xhq7-xmqj-769h e GHSA-333x-w4r6-6crp |

**Alcance.** Os dois pacotes entram só pela CLI do Prisma (`prisma > @prisma/studio-core > @visx/shape > lodash` e `prisma > @prisma/dev > @prisma/streams-local > ajv > fast-uri`), isto é, pelo Prisma Studio e pelo servidor de desenvolvimento. O fechamento das dependências de produção da API (elysia, jose, @prisma/client, @prisma/adapter-pg e @elysiajs/openapi) tem 29 pacotes e não contém lodash, fast-uri nem ajv. A CLI vai para a imagem Docker porque o Bun a instala como peer de `@prisma/client`, e por isso a correção foi feita mesmo sem alcance em execução.

**Correção.** `bun audit fix` (muda 4 linhas do `bun.lock`, sem alterar o `package.json`): lodash 4.17.21 para 4.18.0 e fast-uri 3.1.8 para 3.1.9. Depois: `No vulnerabilities found (checked 189 packages)`.

### V2. Canal de tempo no login

O caso de uso `Autenticar` retornava antes de calcular o hash quando o e-mail não existia, então a resposta para e-mail inexistente era quase instantânea e a de e-mail existente levava o custo do argon2id.

Medição (30 amostras de cada, contra a API em execução):

| | e-mail existente, senha errada | e-mail inexistente |
|---|---|---|
| Antes | mediana 108,3 ms (92,3 a 162,8) | mediana 1,5 ms (1,1 a 10,0): 71 vezes mais rápido, faixas sem sobreposição |
| Depois | mediana 112,2 ms (89,3 a 168,3) | mediana 108,5 ms (88,0 a 166,2): razão 0,97, faixas sobrepostas |

**Correção.** O caso de uso sempre chama `HashSenha.comparar`. Quando o usuário não existe, passa `null`, e o adapter verifica contra um hash de referência gerado na construção, com o mesmo custo dos reais. Testes: `autenticar-tempo.use-case.test.ts` e `bun-hash-senha-tempo.adapter.test.ts`. O teste de tempo do adapter é folgado de propósito (razão entre 0,5 e 2). Antes da correção, a razão era ~0,01.

### V3. Script da documentação sem versão fixa

A página `/openapi` (Scalar) carregava `@scalar/api-reference@latest` de um CDN a cada acesso, de modo que uma versão comprometida seria executada no navegador de quem abrisse a documentação.

**Correção.** `scalar: { version: '1.75.0' }` no `criarApp` (versão publicada em 16/10/2026). Teste: a página contém `@scalar/api-reference@1.75.0/` e não contém `@latest`.

**Residual.** A página ainda depende do CDN jsDelivr. Em produção, desabilitar `/openapi` ou hospedar o bundle.

### V4. Sem limite de tentativas no login

40 tentativas seguidas com senha errada responderam todas 401, sem nenhuma 429. O custo do argon2id (~110 ms por verificação) encarece cada tentativa, mas não a impede.

**Risco aceito no MVP.** Mitigação recomendada: limite de taxa no proxy reverso ou gateway (por exemplo `limit_req` no Nginx). Um limitador em memória do processo não funciona com mais de uma réplica.

### V5. Usuários de demonstração

O job `migrate` do `docker-compose.yml` semeia três usuários com senhas conhecidas (`admin123`, `atendente123` e `mecanico123`), documentadas no README por exigência do enunciado. Em um ambiente real, remover `bun scripts/seed.ts` do comando do job e criar usuários com senhas próprias.

### V6. Cabeçalhos de segurança HTTP

As respostas não trazem `X-Content-Type-Options`, `Cache-Control: no-store` nas respostas de autenticação nem os demais cabeçalhos usuais. Em contrapartida, não expõem `Server` nem `X-Powered-By`, e não há cabeçalhos CORS, então o navegador bloqueia origens externas por padrão. Recomendação: aplicar os cabeçalhos no proxy reverso.

### V7. Estouro de inteiro no banco

Preço, saldo e quantidade são `Int` de 32 bits no PostgreSQL (máximo 2.147.483.647), mas o domínio aceita qualquer inteiro não negativo. Valores isolados acima do limite são recusados na borda com 400. Já a soma pode estourar: duas reposições de 2 bilhões na mesma peça, ou dois serviços de R$ 20 milhões em uma OS, fazem a operação falhar com 500 (sem vazar dado, e a OS e o estoque permanecem intactos, porque a operação é atômica). A correção definitiva é um teto de saldo e de total no domínio. Os dois casos estão registrados como `it.todo` na suíte.

### V8. Imagem de contêiner

Verificado por inspeção da configuração: o processo roda como usuário `bun` (não root), o `.dockerignore` exclui `.env`, `tests/` e o `.git`, o `JWT_SECRET` é injetado em tempo de execução e o compose recusa subir sem ele, e há `HEALTHCHECK`. Não foi possível executar um scanner de imagem no ambiente desta análise. Executar e anexar o resultado:

```bash
docker compose build api
docker scout cves techchallengeapi-api     # ou: trivy image techchallengeapi-api
```

## 3. Controles verificados sem achado

| Controle | Evidência |
|---|---|
| Injeção de SQL | 3 usos de SQL cru, todos `$queryRaw` como *tagged template* (parametrizados pelo Prisma); nenhum `Unsafe` |
| Segredos no repositório | Nenhum segredo versionado; chaves privadas: 0; `.env` ausente do histórico do Git |
| Validação do JWT | Algoritmo fixado (HS256); `alg: none`, assinatura de outro segredo, token expirado e papel desconhecido são recusados; segredo de no mínimo 32 caracteres exigido na subida. Testes em `auth.guard.test.ts` |
| Autorização por papel | Matriz de 32 operações testada para os três papéis e para o acesso sem token (401 e 403), com verificação de que o caso de uso não chega a rodar. Teste de isolamento por plugin de rotas |
| Atribuição em massa | Corpos estritos: campo desconhecido, inclusive campo imutável, é recusado com 400 |
| Validação de entrada | Limites de tamanho nos textos, inteiros estritos (texto numérico é recusado) e teto do `Int` do banco, com testes nos limites exatos |
| Vazamento de informação em erros | Erro inesperado devolve 500 genérico, com o detalhe só no log; resposta fora do contrato vira 500 sem expor o campo extra |
| Enumeração por resposta | Login: mesma resposta para senha errada e e-mail inexistente (e, após V2, o mesmo tempo). Cliente sem login: OS inexistente e documento errado dão exatamente a mesma resposta 404 |
| Acesso a objeto de outro cliente | As rotas do cliente exigem o documento do titular da OS; a tentativa com o documento de outro não altera nada |
| Hash de senha | argon2id (`Bun.password`), com salt por hash |

## 4. Método

- `bun audit` (Bun 1.4.3) sobre o `bun.lock`; `bun why` para o caminho de cada pacote; cálculo do fechamento de dependências de produção; `npm audit` como segunda opinião (resolve uma árvore nova e por isso já reportou 0, o que é coerente com a correção por atualização de versões dentro do intervalo).
- Busca de SQL cru e de segredos nos arquivos versionados e no histórico do Git.
- Medição de tempo do login, cabeçalhos de resposta, CORS e limite de tentativas contra a API em execução.
- Suíte automatizada: 627 testes passando, cobertura total de 98%.

## 5. Como reproduzir

```bash
bun audit                       # dependências
bun why lodash                  # de onde vem cada pacote
docker compose build api && docker scout cves techchallengeapi-api   # imagem (V8)
bun test                        # testes dos controles listados em 3
```

## 6. Riscos residuais

V4 (limite de tentativas), V5 (usuários de demonstração), V6 (cabeçalhos) e V7 (tetos de domínio) seguem abertos e são aceitos para o MVP. V8 depende de executar o scanner de imagem.
