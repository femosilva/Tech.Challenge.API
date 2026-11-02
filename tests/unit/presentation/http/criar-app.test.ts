import { describe, expect, it } from "bun:test";
import { CredenciaisInvalidasError } from "@application/core/erros";
import type { CorpoErro } from "@presentation/http/erros-http.plugin";
import { criarApiFalsa } from "./support/api-falsa";

type Operacao = {
  tags: string[];
  description?: string;
  security?: unknown;
  parameters?: { in: string; name: string; required?: boolean }[];
  responses: Record<string, unknown>;
};
type Spec = {
  openapi: string;
  info: { title: string; version: string };
  tags: { name: string }[];
  components: { securitySchemes: Record<string, unknown> };
  paths: Record<string, Record<string, Operacao>>;
};
const lerSpec = async () => {
  const { app } = criarApiFalsa();
  const resposta = await app.handle(
    new Request("http://localhost/openapi/json"),
  );
  return { resposta, spec: (await resposta.json()) as Spec };
};

describe("criarApp", () => {
  it("GET /health responde 200 com status ok, sem depender de banco", async () => {
    const { requisitar } = criarApiFalsa();

    const resposta = await requisitar("GET", "/health");

    expect(resposta.status).toBe(200);
    expect(resposta.corpo).toEqual({ status: "ok" });
  });

  it("rota inexistente usa o formato único de erro", async () => {
    const { requisitar } = criarApiFalsa();

    const resposta = await requisitar("GET", "/nao-existe");

    expect(resposta.status).toBe(404);
    expect(resposta.corpo as CorpoErro).toEqual({
      erro: { codigo: "ROTA_NAO_ENCONTRADA", mensagem: "Rota não encontrada" },
    });
  });

  describe("documentação OpenAPI", () => {
    it("publica o spec em /openapi/json com os caminhos da API, sem barra final", async () => {
      const { resposta, spec } = await lerSpec();

      expect(resposta.status).toBe(200);
      expect(spec.openapi).toMatch(/^3\./);
      expect(spec.info).toMatchObject({
        title: "API da Oficina Mecânica",
        version: "1.0.0",
      });
      expect(Object.keys(spec.paths).sort()).toEqual([
        "/api/v1/auth/login",
        "/api/v1/cliente/ordens-servico/{id}",
        "/api/v1/cliente/ordens-servico/{id}/orcamento/aprovar",
        "/api/v1/cliente/ordens-servico/{id}/orcamento/rejeitar",
        "/api/v1/clientes",
        "/api/v1/clientes/{id}",
        "/api/v1/clientes/{id}/veiculos",
        "/api/v1/metricas/tempo-medio-execucao",
        "/api/v1/ordens-servico",
        "/api/v1/ordens-servico/{id}",
        "/api/v1/ordens-servico/{id}/entregar",
        "/api/v1/ordens-servico/{id}/enviar-orcamento",
        "/api/v1/ordens-servico/{id}/finalizar",
        "/api/v1/ordens-servico/{id}/iniciar-diagnostico",
        "/api/v1/ordens-servico/{id}/pecas",
        "/api/v1/ordens-servico/{id}/servicos",
        "/api/v1/pecas",
        "/api/v1/pecas/{id}",
        "/api/v1/pecas/{id}/reposicoes",
        "/api/v1/servicos",
        "/api/v1/servicos/{id}",
        "/api/v1/veiculos",
        "/api/v1/veiculos/{id}",
        "/health",
      ]);
      expect(spec.tags.map((tag) => tag.name)).toEqual([
        "Sistema",
        "Autenticação",
        "Clientes",
        "Veículos",
        "Serviços",
        "Peças",
        "Ordens de Serviço",
        "Acompanhamento do cliente",
        "Métricas",
      ]);
    });

    it("toda rota protegida declara o cadeado, os papéis permitidos e as respostas 401 e 403", async () => {
      const { spec } = await lerSpec();
      const operacoes = Object.entries(spec.paths).flatMap(
        ([caminho, metodos]) =>
          Object.entries(metodos).map(([metodo, operacao]) => ({
            caminho,
            metodo,
            operacao,
          })),
      );
      const publicas = ["/health", "/api/v1/auth/login"];
      const protegidas = operacoes.filter(
        ({ caminho }) =>
          !publicas.includes(caminho) &&
          !caminho.startsWith("/api/v1/cliente/"),
      );
      expect(protegidas).toHaveLength(32);

      expect(protegidas).toHaveLength(22);
      expect(spec.components.securitySchemes).toHaveProperty("bearerAuth");
      for (const { caminho, metodo, operacao } of protegidas) {
        const rotulo = `${metodo.toUpperCase()} ${caminho}`;
        expect([rotulo, operacao.security]).toEqual([
          rotulo,
          [{ bearerAuth: [] }],
        ]);
        expect([
          rotulo,
          operacao.description?.startsWith("Papéis permitidos: "),
        ]).toEqual([rotulo, true]);
        expect(Object.keys(operacao.responses)).toEqual(
          expect.arrayContaining(["401", "403"]),
        );
      }
    });
    it("as rotas do cliente ficam fora do cadeado e documentam o cabeçalho X-Documento", async () => {
      const { spec } = await lerSpec();
      const rotasDoCliente = Object.entries(spec.paths).filter(([caminho]) =>
        caminho.startsWith("/api/v1/cliente/"),
      );

      expect(rotasDoCliente).toHaveLength(3);
      for (const [caminho, metodos] of rotasDoCliente) {
        for (const operacao of Object.values(metodos)) {
          expect([caminho, operacao.security]).toEqual([caminho, undefined]);
          expect(operacao.tags).toEqual(["Acompanhamento do cliente"]);
          expect(
            operacao.parameters?.some(
              (parametro) =>
                parametro.in === "header" &&
                parametro.name === "x-documento" &&
                parametro.required,
            ),
          ).toBe(true);
        }
      }
    });
    it("health e login ficam fora do cadeado", async () => {
      const { spec } = await lerSpec();

      expect(spec.paths["/health"]!.get!.security).toBeUndefined();
      expect(spec.paths["/api/v1/auth/login"]!.post!.security).toBeUndefined();
      expect(spec.paths["/api/v1/auth/login"]!.post!.tags).toEqual([
        "Autenticação",
      ]);
      expect(
        Object.keys(spec.paths["/api/v1/auth/login"]!.post!.responses).sort(),
      ).toEqual(["200", "400", "401"]);
    });

    it("serve a interface em /openapi", async () => {
      const { app } = criarApiFalsa();

      const resposta = await app.handle(
        new Request("http://localhost/openapi"),
      );

      expect(resposta.status).toBe(200);
      expect(resposta.headers.get("content-type")).toContain("text/html");
      const html = await resposta.text();
      expect(html).toContain("scalar");
      // o script da interface vem de CDN: a versão tem de estar fixada, nunca `latest`
      expect(html).toContain("@scalar/api-reference@1.75.0/");
      expect(html).not.toContain("@latest");
    });
  });

  describe("POST /api/v1/auth/login", () => {
    const CREDENCIAIS = { email: "admin@oficina.local", senha: "admin123" };

    it("entrega e-mail e senha ao caso de uso e devolve o token", async () => {
      const { requisitar, casos } = criarApiFalsa();

      const resposta = await requisitar("POST", "/api/v1/auth/login", {
        corpo: CREDENCIAIS,
      });

      expect(resposta.status).toBe(200);
      expect(resposta.corpo).toEqual({ token: "token-de-teste" });
      expect(casos.autenticar.executar).toHaveBeenCalledTimes(1);
      expect(casos.autenticar.executar).toHaveBeenCalledWith(CREDENCIAIS);
    });

    it("aceita os limites exatos de tamanho (e-mail com 254 e senha com 128 caracteres)", async () => {
      const { requisitar } = criarApiFalsa();

      const resposta = await requisitar("POST", "/api/v1/auth/login", {
        corpo: { email: `${"a".repeat(250)}@b.c`, senha: "x".repeat(128) },
      });

      expect(resposta.status).toBe(200);
    });

    it("só existe sob o prefixo /api/v1", async () => {
      const { requisitar } = criarApiFalsa();

      const resposta = await requisitar("POST", "/auth/login", {
        corpo: CREDENCIAIS,
      });

      expect(resposta.status).toBe(404);
    });

    it("credenciais inválidas viram 401 no formato único, sem revelar o que falhou", async () => {
      const { requisitar, casos } = criarApiFalsa();
      casos.autenticar.executar.mockRejectedValueOnce(
        new CredenciaisInvalidasError(),
      );

      const resposta = await requisitar("POST", "/api/v1/auth/login", {
        corpo: { email: "x@oficina.local", senha: "errada" },
      });

      expect(resposta.status).toBe(401);
      expect(resposta.corpo as CorpoErro).toEqual({
        erro: {
          codigo: "CredenciaisInvalidasError",
          mensagem: "Credenciais inválidas",
        },
      });
    });

    it("corpo fora do formato vira 400 e o caso de uso nem é chamado", async () => {
      const { requisitar, casos } = criarApiFalsa();
      const invalidos = [
        {},
        { email: "a@b.c" },
        { senha: "x" },
        { email: "", senha: "x" },
        { email: "a@b.c", senha: "" },
        { email: 123, senha: "x" },
        { email: "a@b.c", senha: "x".repeat(129) },
        { email: `${"a".repeat(251)}@b.c`, senha: "x" },
        { ...CREDENCIAIS, papel: "ADMINISTRADOR" },
      ];

      for (const corpo of invalidos) {
        const resposta = await requisitar("POST", "/api/v1/auth/login", {
          corpo,
        });
        expect([resposta.status, resposta.corpo.erro.codigo]).toEqual([
          400,
          "VALIDACAO",
        ]);
      }
      expect(casos.autenticar.executar).not.toHaveBeenCalled();
    });
  });
});
