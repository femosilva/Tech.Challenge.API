# Oficina Mecânica: Sistema Integrado de Atendimento e Execução de Serviços

Back-end (MVP) para gestão de ordens de serviço, clientes, veículos, serviços e estoque de peças de uma oficina mecânica.
Projeto do **Tech Challenge, Fase 1** da pós-graduação **SOAT (Software Architecture)**, FIAP.

## Sumário

1. [Objetivo](#1-objetivo)
2. [Descrição da solução](#2-descrição-da-solução)
3. [Arquitetura](#3-arquitetura)
4. [Tecnologias](#4-tecnologias)
5. [Pré-requisitos](#5-pré-requisitos)
6. [Como executar](#6-como-executar)
7. [Testes](#7-testes)
8. [Documentação da API (Swagger)](#8-documentação-da-api-swagger)
9. [Banco de dados: decisão e justificativa](#9-banco-de-dados-decisão-e-justificativa)
10. [Autenticação e usuários de demonstração](#10-autenticação-e-usuários-de-demonstração)
11. [Estrutura de diretórios](#11-estrutura-de-diretórios)
12. [Documentação DDD](#12-documentação-ddd)
13. [Vídeo da entrega](#13-vídeo-da-entrega)
14. [Segurança](#14-segurança)
15. [Limitações conhecidas](#15-limitações-conhecidas)

---

## 1. Objetivo

Uma oficina mecânica de médio porte controla hoje atendimento, diagnóstico, execução e entrega dos veículos com anotações
manuais e planilhas. Isso gera erros na priorização, falhas no controle de peças, dificuldade de acompanhar o status dos
serviços, perda do histórico de clientes e veículos e ineficiência no fluxo de orçamentos e autorizações.

Este projeto é a primeira versão (MVP) do back-end que resolve esse cenário, aplicando **Domain-Driven Design** e boas
práticas de **qualidade de software** e **segurança**:

- abrir e acompanhar ordens de serviço (OS), com orçamento gerado automaticamente a partir dos serviços e peças;
- permitir que o cliente acompanhe a OS e aprove ou rejeite o orçamento pela API;
- gerir clientes, veículos, serviços, peças e estoque;
- medir o tempo médio de execução dos serviços.

## 2. Descrição da solução

Uma API REST monolítica, organizada em camadas, com autenticação JWT para a equipe da oficina (Atendente, Mecânico e
Administrador). O cliente não tem login: acompanha a OS e decide o orçamento informando o número da OS e o CPF/CNPJ.

### Fluxo da Ordem de Serviço

```mermaid
flowchart LR
    R(["Recebida"]) -->|"iniciar diagnóstico"| D(["Em diagnóstico"])
    D -->|"enviar orçamento"| A(["Aguardando aprovação"])
    A -->|"aprovar"| E(["Em execução"])
    A -->|"rejeitar"| D
    E -->|"finalizar"| F(["Finalizada"])
    F -->|"entregar"| T(["Entregue"])
```

| Etapa | Quem | O que acontece |
|---|---|---|
| Abrir a OS | Atendente | Identifica o cliente por CPF/CNPJ e o veículo pela placa. A OS nasce em **Recebida** |
| Incluir serviços e peças | Equipe | Só em Recebida ou Em diagnóstico. O preço é copiado no momento da inclusão |
| Iniciar o diagnóstico | Mecânico | **Em diagnóstico** |
| Enviar o orçamento | Atendente | O orçamento é gerado a partir dos itens e enviado. **Aguardando aprovação** |
| Aprovar | Cliente | **Em execução**. O estoque das peças é baixado **na mesma transação**. Sem saldo, a aprovação é recusada (422) e nada muda |
| Rejeitar | Cliente | A OS volta para **Em diagnóstico**; os itens podem ser ajustados e um novo orçamento enviado |
| Finalizar | Mecânico | **Finalizada**. Registra o fim da execução |
| Entregar | Atendente | **Entregue** |

Toda mudança de status é guardada em um histórico com data e hora. Transições fora de ordem são recusadas com 422 e a mensagem
do domínio (por exemplo, `Transição inválida: RECEBIDA -> FINALIZADA`).

## 3. Arquitetura

**Back-end monolítico em camadas, seguindo Clean Architecture.** A dependência sempre aponta para dentro:

```mermaid
flowchart LR
    P["Presentation"] --> A["Application"]
    I["Infrastructure"] --> A
    A --> D["Domain"]
    I --> D
```

| Camada | Responsabilidade | Pasta |
|---|---|---|
| **Domain** | Agregados, objetos de valor, eventos de domínio e regras de negócio. Não depende de nada | `src/domain` |
| **Application** | Casos de uso (um por ação) e portas (`UnitOfWork`, `PublicadorEventos`, hash de senha, token) | `src/application` |
| **Infrastructure** | Repositórios com Prisma, transação, JWT, argon2id, publicação de eventos | `src/infrastructure` |
| **Presentation** | Rotas REST (Elysia), validação de formato, guard de JWT por papel, erros HTTP e OpenAPI | `src/presentation/http` |

Pontos centrais da arquitetura:

- O **Elysia** só aparece na Presentation e o **Prisma** só na Infrastructure.
- Só o `src/composition-root.ts` conhece a Infrastructure: ele cria os adapters, monta os casos de uso e entrega ao guard o
  segredo e o algoritmo do JWT.
- Cada rota só valida o formato da entrada e chama um caso de uso. As regras de negócio ficam no domínio.
- **Transações:** a porta `UnitOfWork` (Application) é implementada com `prisma.$transaction`. Aprovar o orçamento e dar baixa
  no estoque acontecem de forma atômica, com trava de linha (`SELECT ... FOR UPDATE`) na OS e nas peças.
- **Eventos de domínio:** os agregados registram eventos e a Application os publica pela porta `PublicadorEventos`. No MVP a
  implementação só escreve uma linha de log (nome, horário e identificadores, sem dado pessoal).

### Contextos delimitados (DDD)

| Contexto | Tipo | Agregados |
|---|---|---|
| Ordem de Serviço | Domínio central | `OrdemServico` (com itens, orçamento e histórico como objetos de valor) |
| Cadastro | Suporte | `Cliente`, `Veiculo` |
| Catálogo de Serviços | Suporte | `Servico` |
| Estoque | Suporte | `Peca` (peças e insumos são o mesmo conceito) |
| Identidade e Acesso | Genérico | `Usuario` |

Os detalhes (Event Storming, context map, modelo de domínio, linguagem ubíqua) estão na [documentação DDD](#12-documentação-ddd).

## 4. Tecnologias

| Item | Tecnologia |
|---|---|
| Linguagem / runtime | TypeScript no **Bun** 1.4.3 |
| Framework HTTP | **Elysia** 1.4.30 |
| Documentação da API | `@elysiajs/openapi` 1.4.16 (interface **Scalar**) |
| Banco de dados | **PostgreSQL** 16 |
| ORM | **Prisma** 7.10.1 com `@prisma/adapter-pg` |
| JWT | `jose` 6.2.13 (HS256) |
| Hash de senha | argon2id (`Bun.password`) |
| Testes | `bun test` (runner do Bun) com cobertura |
| Contêineres | Docker e Docker Compose |

## 5. Pré-requisitos

| Para | Você precisa de |
|---|---|
| Rodar tudo em contêineres | [Docker](https://docs.docker.com/get-docker/) com Docker Compose |
| Desenvolver ou rodar os testes | [Bun](https://bun.sh) 1.4 ou superior e Docker (para o PostgreSQL) |
| Gerar o segredo do JWT | `openssl` (ou qualquer string aleatória com 32 caracteres ou mais) |

## 6. Como executar

### Variáveis de ambiente

| Variável | Obrigatória | Padrão | Observação |
|---|---|---|---|
| `DATABASE_URL` | sim | n/d | A aplicação não sobe sem ela |
| `JWT_SECRET` | sim | nenhum | Mínimo de 32 caracteres. Não existe segredo padrão, de propósito |
| `JWT_EXPIRES_IN` | não | `1h` | Validade do token (token único, sem refresh) |
| `PORT` | não | `3000` | Número de 1 a 65535 |
| `TEST_DATABASE_URL` | só nos testes | n/d | Precisa terminar em `_test` |

### A) Docker (ambiente completo, recomendado)

```bash
cp .env.example .env
# edite o .env e preencha JWT_SECRET (mínimo de 32 caracteres). Para gerar um:
#   openssl rand -base64 48
docker compose up --build
```

Sobem três serviços, em ordem:

1. `db`: PostgreSQL 16;
2. `migrate`: aplica as migrations, semeia os 3 usuários de demonstração e termina com código 0;
3. `api`: a API, na porta 3000.

O `docker compose` recusa subir sem `JWT_SECRET`. Para conferir:

```bash
curl http://localhost:3000/health     # {"status":"ok"}
```

- API: http://localhost:3000
- Documentação: http://localhost:3000/openapi

Para parar e apagar também os dados do banco: `docker compose down -v`.

### B) Desenvolvimento local (API no Bun, banco no Docker)

```bash
bun install                    # o postinstall gera o client do Prisma
cp .env.example .env           # preencha JWT_SECRET
docker compose up -d db        # só o banco
bun run db:deploy              # aplica as migrations
bun run db:seed                # cria os usuários de demonstração
bun run dev                    # http://localhost:3000, com reload
```

Scripts do `package.json`:

| Script | O que faz |
|---|---|
| `bun run dev` | Sobe a API com reload |
| `bun run test` | Roda os testes com cobertura |
| `bun run db:migrate` | `prisma migrate dev` (cria uma nova migration) |
| `bun run db:deploy` | `prisma migrate deploy` (aplica as migrations existentes) |
| `bun run db:seed` | Cria os usuários de demonstração (idempotente) |

## 7. Testes

Os testes unitários não precisam de banco. Os de integração usam **PostgreSQL real** e recusam rodar se a
`TEST_DATABASE_URL` não terminar em `_test`.

```bash
docker compose up -d db
docker compose exec db psql -U postgres -c "CREATE DATABASE oficina_test"
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/oficina_test bunx --bun prisma migrate deploy
bun test
```

A `TEST_DATABASE_URL` já vem no `.env.example`. A cobertura é calculada a cada execução (`bunfig.toml`) e o relatório aparece ao
final do `bun test`.

| Tipo | Onde | O que cobre |
|---|---|---|
| Unitários | `tests/unit/domain` | Agregados, objetos de valor, regras de transição, invariantes |
| Unitários | `tests/unit/application` | Casos de uso com repositórios falsos |
| Unitários | `tests/unit/infrastructure` | Mappers, JWT, hash de senha, tradução de erros do banco |
| Unitários | `tests/unit/presentation` | Rotas com casos de uso falsos: formato, status e matriz de papéis |
| Integração | `tests/integration/persistence` | Repositórios, transações e concorrência na baixa de estoque, com PostgreSQL real |
| Integração | `tests/integration/presentation` | API de ponta a ponta: OS completa, aprovação com baixa de estoque, rejeição, estoque insuficiente, vínculos e permissões |

**Cobertura mínima de 80% de linhas**: o `bunfig.toml` falha a execução abaixo desse limite. Na última medição, a cobertura de
linhas foi de **98,11%**.

## 8. Documentação da API (Swagger)

A API é documentada com **OpenAPI**, exibida na interface **Scalar**:

| O quê | URL |
|---|---|
| Interface interativa | http://localhost:3000/openapi |
| Especificação (JSON) | http://localhost:3000/openapi/json |

Para chamar as rotas protegidas pela interface, clique no botão de autenticação, escolha o esquema **Bearer** e cole o token
obtido no login (veja a [seção 10](#10-autenticação-e-usuários-de-demonstração)).

### Convenções da API

- Rotas sob `/api/v1`. O `GET /health` fica fora do prefixo.
- Criação devolve `201` com `{ "id": "..." }` e o cabeçalho `Location`.
- Atualização, remoção e transições de status devolvem `204`, sem corpo.
- Preços em **centavos** (inteiros). Datas em ISO 8601, em UTC.
- Corpo com campo desconhecido é `400`.
- Listagem de OS: `?pagina=` e `?tamanho=` (padrão 20, máximo 100), das mais recentes para as mais antigas.
- Erros no formato `{ "erro": { "codigo": "...", "mensagem": "...", "detalhes": [...] } }`.

| Situação | Status |
|---|---|
| Formato inválido (corpo, parâmetros, cabeçalho) ou JSON malformado | 400 |
| Sem token, token inválido ou expirado; login com credenciais erradas | 401 |
| Papel sem permissão | 403 |
| Id da URL inexistente ou rota inexistente | 404 |
| Conflito: documento, placa ou código repetidos; remover com vínculo | 409 |
| Regra de negócio violada ou referência inexistente no corpo | 422 |
| Erro inesperado (o detalhe fica só no log) | 500 |

### Rotas principais

| Recurso | Rotas | Quem pode |
|---|---|---|
| Autenticação | `POST /auth/login` | público |
| Clientes | `GET /clientes`, `GET /clientes/{id}`, `GET /clientes/{id}/veiculos` | Atendente, Mecânico, Administrador |
| | `POST /clientes`, `PATCH /clientes/{id}` | Atendente, Administrador |
| | `DELETE /clientes/{id}` | Administrador |
| Veículos | `GET /veiculos`, `GET /veiculos/{id}` | Atendente, Mecânico, Administrador |
| | `POST /veiculos`, `PATCH /veiculos/{id}` | Atendente, Administrador |
| | `DELETE /veiculos/{id}` | Administrador |
| Serviços e peças | `GET /servicos`, `GET /servicos/{id}`, `GET /pecas`, `GET /pecas/{id}` | Atendente, Mecânico, Administrador |
| | `POST`, `PATCH` e `DELETE` de `/servicos` e `/pecas` | Administrador |
| Estoque | `POST /pecas/{id}/reposicoes` | Administrador |
| Ordens de serviço | `GET /ordens-servico`, `GET /ordens-servico/{id}` | Atendente, Mecânico, Administrador |
| | `POST /ordens-servico` (abre a OS por CPF/CNPJ e placa) | Atendente, Administrador |
| | `POST /ordens-servico/{id}/servicos` e `/pecas` | Atendente, Mecânico, Administrador |
| | `POST /ordens-servico/{id}/iniciar-diagnostico` e `/finalizar` | Mecânico, Administrador |
| | `POST /ordens-servico/{id}/enviar-orcamento` e `/entregar` | Atendente, Administrador |
| Cliente (sem login) | `GET /cliente/ordens-servico/{id}`, `POST .../orcamento/aprovar` e `.../rejeitar` | público, com `X-Documento` |
| Métricas | `GET /metricas/tempo-medio-execucao` | Administrador |

## 9. Banco de dados: decisão e justificativa

**Escolha: PostgreSQL 16, acessado pelo Prisma.**

### Por que um banco relacional

O domínio é fortemente relacional (uma OS referencia cliente, veículo, serviços e peças) e o fluxo principal altera mais de um
agregado de uma vez: aprovar o orçamento muda o status da OS **e** dá baixa no estoque. Isso exige transação.

### Por que PostgreSQL

- **Transações ACID e travas de linha.** O `UnitOfWork` usa `prisma.$transaction` e `SELECT ... FOR UPDATE` na OS e nas peças.
  As peças são carregadas em ordem de id para que duas aprovações que dividem peças nunca se travem em ordens opostas
  (deadlock). Se faltar saldo, nada é gravado.
- **Integridade garantida pelo banco**, como última linha de defesa (as regras de negócio continuam no domínio):
  - unicidade de documento do cliente, placa do veículo, código da peça e e-mail do usuário;
  - chaves estrangeiras `Restrict`: não é possível remover cliente, veículo, serviço ou peça com vínculo (erro 409);
  - itens e histórico de status caem junto com a OS (`Cascade`).
- **Tipos adequados:** datas em `timestamptz(3)` e valores monetários em centavos (inteiros), sem erro de arredondamento.
- **Consultas:** índices por chave estrangeira e por data de abertura da OS; o tempo médio de execução é calculado em uma
  consulta agregada em SQL.
- **Ambiente simples de reproduzir:** a imagem oficial roda no `docker-compose.yml`, então quem avaliar sobe tudo com um comando.

O saldo nunca ficar negativo é uma invariante do domínio (`Peca`/`Quantidade`), protegida pela trava de linha durante a baixa.

### Alternativas consideradas

| Alternativa | Motivo de não ter sido escolhida |
|---|---|
| MongoDB | A OS caberia como documento, mas aprovar o orçamento altera OS e estoque juntos. Exigiria transações multi-documento e abriria mão das chaves estrangeiras que protegem os vínculos |
| MySQL | Também atenderia. O PostgreSQL foi preferido pelas travas de linha explícitas, `timestamptz` e a familiaridade da equipe |
| SQLite | Simples, mas não representa um banco em contêiner separado e lida pior com acesso concorrente |

### Por que Prisma

Schema declarativo e **migrations versionadas** (`prisma/`), client tipado em TypeScript e suporte a transações. Fica isolado na
Infrastructure: os repositórios convertem os modelos do Prisma em agregados de domínio, e Domain e Application não conhecem o
ORM. Trocar de banco exigiria mexer apenas na Infrastructure.

## 10. Autenticação e usuários de demonstração

**Equipe da oficina:** login com e-mail e senha, que devolve um **JWT** (HS256, expiração configurável, sem refresh). As senhas
são guardadas com **argon2id**. Os papéis são `ATENDENTE`, `MECANICO` e `ADMINISTRADOR`. O Administrador pode tudo o que a
equipe pode. O token é validado por um guard da Presentation, que aplica o papel exigido por cada rota.

Os três usuários de demonstração são criados pelo seed (`bun run db:seed`, ou automaticamente pelo `docker compose`):

| E-mail | Senha | Papel |
|---|---|---|
| `atendente@oficina.local` | `atendente123` | ATENDENTE |
| `mecanico@oficina.local` | `mecanico123` | MECANICO |
| `admin@oficina.local` | `admin123` | ADMINISTRADOR |

> Credenciais **somente para demonstração**. Troque ou remova os usuários em qualquer ambiente real.

```bash
# 1. Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@oficina.local","senha":"admin123"}'
# {"token":"..."}

# 2. Chamar uma rota protegida
curl http://localhost:3000/api/v1/pecas -H "Authorization: Bearer <token>"
```

Sem token, token inválido ou expirado a resposta é `401`; com papel sem permissão, `403`.

**Cliente (sem login):** acompanha e decide o orçamento informando o número da OS na URL e o CPF/CNPJ no cabeçalho
`X-Documento`.

```bash
curl http://localhost:3000/api/v1/cliente/ordens-servico/<id-da-os> \
  -H "X-Documento: 529.982.247-25"

curl -X POST http://localhost:3000/api/v1/cliente/ordens-servico/<id-da-os>/orcamento/aprovar \
  -H "X-Documento: 529.982.247-25"
```

OS inexistente e documento que não confere dão exatamente a mesma resposta `404`, para não revelar se a OS existe.

## 11. Estrutura de diretórios

```
.
├── src/
│   ├── domain/                 agregados, objetos de valor e regras de negócio
│   │   ├── cadastro/           Cliente e Veiculo
│   │   ├── catalogo/           Servico
│   │   ├── estoque/            Peca
│   │   ├── identidade/         Usuario
│   │   ├── ordem-servico/      OrdemServico, ItemServico, ItemPeca, Orcamento, RegistroStatus
│   │   ├── value-objects/      CpfCnpj, Placa, Dinheiro, Quantidade, StatusOS, Papel
│   │   └── core/               AggregateRoot, Entity, ValueObject, DomainEvent, DomainError
│   ├── application/            casos de uso e portas (mesmos contextos, mais core/)
│   ├── infrastructure/
│   │   ├── persistence/        repositórios, mappers e UnitOfWork (Prisma)
│   │   ├── auth/               JWT (jose) e hash de senha (argon2id)
│   │   └── events/             publicador de eventos de domínio (log)
│   ├── presentation/http/      rotas, schemas, guard de JWT, tratamento de erros, OpenAPI
│   ├── composition-root.ts     único ponto que liga as camadas
│   ├── config-ambiente.ts      leitura e validação das variáveis de ambiente
│   └── index.ts                sobe o servidor
├── prisma/                     schema.prisma e migrations
├── scripts/seed.ts             usuários de demonstração
├── tests/
│   ├── unit/                   domain, application, infrastructure, presentation
│   └── integration/            persistência e API, com PostgreSQL real
├── docs/
│   ├── ddd/                    documentação DDD exportada do Miro
│   └── seguranca/              relatório de análise de vulnerabilidades
├── Dockerfile
├── docker-compose.yml
├── bunfig.toml                 configuração de testes e cobertura mínima
└── .env.example
```

## 12. Documentação DDD

- **Board no Miro:** https://miro.com/app/board/uXjVEd_uweU=/ (acesso por link, sem pedir permissão)
- **Exportada neste repositório**, em `docs/ddd/`:

| Arquivo | Conteúdo |
|---|---|
| [`event-storming.pdf`](docs/ddd/event-storming.pdf) | Event Storming da criação da OS, do acompanhamento da OS e da gestão de peças e insumos |
| [`diagramas.pdf`](docs/ddd/diagramas.pdf) | Bounded contexts e context map, ciclo de vida da OS, modelo de domínio, regras de transição e agregados |
| [`linguagem-ubiqua.md`](docs/ddd/linguagem-ubiqua.md) | Linguagem ubíqua e glossário, com o nome de cada termo no código |

Os quadros do Miro seguem a ordem: 1 a 3 (Event Storming), 4 (contextos), 5 (ciclo de vida), 6 (modelo de domínio),
7 (regras de transição), 8 (agregados e invariantes), 9 (glossário) e 10 (relação entre a documentação e o código).

## 13. Vídeo da entrega

▶ **(https://youtu.be/B7STB9HZiys)**

## 14. Segurança

O relatório completo está em [`docs/seguranca/analise-de-vulnerabilidades.md`](docs/seguranca/analise-de-vulnerabilidades.md).
Resumo:

- `bun audit` encontrou 7 vulnerabilidades em dependências (todas na CLI do Prisma, fora da execução da API). Foram corrigidas e o
  resultado atual é 0.
- Corrigido um canal de tempo no login, que permitia descobrir e-mails cadastrados.
- Versão do Scalar fixada, em vez de carregar `latest` de CDN.
- Aceitos no MVP e documentados: sem limite de tentativas no login, sem cabeçalhos de segurança HTTP e usuários de demonstração
  semeados no compose.
- Segredo do JWT obrigatório e sem valor padrão; senhas com argon2id; nenhum segredo versionado.

## 15. Limitações conhecidas

- Edição simultânea da mesma OS (fora da aprovação): vale a última gravação, sem controle de versão.
- Preço e saldo usam inteiro de 32 bits. Valores isolados acima do limite viram `400`, mas saldo acumulado e total de orçamento
  acima de 2.147.483.647 viram `500` (a operação é atômica, nada é corrompido).
- Só a listagem de OS tem paginação (clientes, veículos, serviços e peças não têm).
- Token JWT único, sem refresh e sem revogação; a mudança de papel só vale no próximo token.
- Sem CORS configurado e sem cabeçalhos de segurança HTTP.
- `/health` verifica só se o processo está de pé, não o banco.
- Multi-tenant e controle de acesso por CASL ficaram fora do escopo do MVP.

---
