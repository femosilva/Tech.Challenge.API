import type {
  DetalharOrdemServico,
  EntregarVeiculo,
  FinalizarServico,
  ListarOrdensServico,
} from "@application/ordem-servico/acompanhamento";
import type {
  AbrirOS,
  EnviarOrcamento,
  IncluirPeca,
  IncluirServico,
  IniciarDiagnostico,
} from "@application/ordem-servico/criacao";
import type { AuthGuard } from "@presentation/http/auth.guard";
import {
  criadoResposta,
  criado,
  detalhe,
  type Executa,
  idParams,
  semConteudo,
} from "@presentation/http/comum";
import { erroResposta } from "@presentation/http/erro.schema";
import {
  PODE_ATENDER,
  PODE_CONSULTAR,
  PODE_EXECUTAR,
  PODE_MONTAR_ORCAMENTO,
} from "@presentation/http/papeis";
import { Elysia, t } from "elysia";
import {
  detalheParaResposta,
  paginaParaResposta,
} from "./ordem-servico.mapper";
import {
  abrirOrdemServicoBody,
  incluirPecaBody,
  incluirServicoBody,
  listarOrdensQuery,
  ordemServicoDetalheResposta,
  paginaOrdensResposta,
} from "./ordem-servico.schema";

const TAG = "Ordens de Serviço";

export type CasosOrdensServico = {
  abrirOS: Executa<AbrirOS>;
  iniciarDiagnostico: Executa<IniciarDiagnostico>;
  incluirServico: Executa<IncluirServico>;
  incluirPeca: Executa<IncluirPeca>;
  enviarOrcamento: Executa<EnviarOrcamento>;
  finalizarServico: Executa<FinalizarServico>;
  entregarVeiculo: Executa<EntregarVeiculo>;
  listarOrdensServico: Executa<ListarOrdensServico>;
  detalharOrdemServico: Executa<DetalharOrdemServico>;
};

/** Transições são comandos (uma rota por ação), para a regra de status continuar só no domínio. */
const respostasDeTransicao = {
  204: t.Void(),
  404: erroResposta,
  422: erroResposta,
};

export const ordensServicoRoutes = (
  casos: CasosOrdensServico,
  guard: AuthGuard,
) =>
  new Elysia({ prefix: "/ordens-servico" })
    .use(guard)
    .post(
      "",
      async ({ body, request, set }) =>
        criado({ request, set }, await casos.abrirOS.executar(body)),
      {
        papeis: PODE_ATENDER,
        body: abrirOrdemServicoBody,
        response: { 201: criadoResposta, 400: erroResposta, 422: erroResposta },
        detail: detalhe(
          TAG,
          PODE_ATENDER,
          "Abre uma OS para o cliente (CPF/CNPJ) e um veículo dele (placa)",
        ),
      },
    )
    .get(
      "",
      async ({ query }) =>
        paginaParaResposta(await casos.listarOrdensServico.executar(query)),
      {
        papeis: PODE_CONSULTAR,
        query: listarOrdensQuery,
        response: { 200: paginaOrdensResposta, 400: erroResposta },
        detail: detalhe(
          TAG,
          PODE_CONSULTAR,
          "Lista as OS, das mais recentes para as mais antigas, com paginação",
        ),
      },
    )
    .get(
      "/:id",
      async ({ params }) =>
        detalheParaResposta(await casos.detalharOrdemServico.executar(params)),
      {
        papeis: PODE_CONSULTAR,
        params: idParams,
        response: { 200: ordemServicoDetalheResposta, 404: erroResposta },
        detail: detalhe(
          TAG,
          PODE_CONSULTAR,
          "Detalha uma OS: itens, orçamento, histórico de status e tempos de execução",
        ),
      },
    )
    .post(
      "/:id/servicos",
      async ({ params, body, set }) => {
        await casos.incluirServico.executar({
          id: params.id,
          servicoId: body.servicoId,
        });
        semConteudo(set);
      },
      {
        papeis: PODE_MONTAR_ORCAMENTO,
        params: idParams,
        body: incluirServicoBody,
        response: { ...respostasDeTransicao, 400: erroResposta },
        detail: detalhe(
          TAG,
          PODE_MONTAR_ORCAMENTO,
          "Inclui um serviço do catálogo (só em Recebida ou Em diagnóstico)",
        ),
      },
    )
    .post(
      "/:id/pecas",
      async ({ params, body, set }) => {
        await casos.incluirPeca.executar({
          id: params.id,
          pecaId: body.pecaId,
          quantidade: body.quantidade,
        });
        semConteudo(set);
      },
      {
        papeis: PODE_MONTAR_ORCAMENTO,
        params: idParams,
        body: incluirPecaBody,
        response: { ...respostasDeTransicao, 400: erroResposta },
        detail: detalhe(
          TAG,
          PODE_MONTAR_ORCAMENTO,
          "Inclui uma peça ou insumo (só em Recebida ou Em diagnóstico)",
        ),
      },
    )
    .post(
      "/:id/iniciar-diagnostico",
      async ({ params, set }) => {
        await casos.iniciarDiagnostico.executar(params);
        semConteudo(set);
      },
      {
        papeis: PODE_EXECUTAR,
        params: idParams,
        response: respostasDeTransicao,
        detail: detalhe(TAG, PODE_EXECUTAR, "Recebida → Em diagnóstico"),
      },
    )
    .post(
      "/:id/enviar-orcamento",
      async ({ params, set }) => {
        await casos.enviarOrcamento.executar(params);
        semConteudo(set);
      },
      {
        papeis: PODE_ATENDER,
        params: idParams,
        response: respostasDeTransicao,
        detail: detalhe(
          TAG,
          PODE_ATENDER,
          "Gera o orçamento com os itens e o envia ao cliente: Em diagnóstico → Aguardando aprovação",
        ),
      },
    )
    .post(
      "/:id/finalizar",
      async ({ params, set }) => {
        await casos.finalizarServico.executar(params);
        semConteudo(set);
      },
      {
        papeis: PODE_EXECUTAR,
        params: idParams,
        response: respostasDeTransicao,
        detail: detalhe(
          TAG,
          PODE_EXECUTAR,
          "Em execução → Finalizada (registra o fim da execução)",
        ),
      },
    )
    .post(
      "/:id/entregar",
      async ({ params, set }) => {
        await casos.entregarVeiculo.executar(params);
        semConteudo(set);
      },
      {
        papeis: PODE_ATENDER,
        params: idParams,
        response: respostasDeTransicao,
        detail: detalhe(TAG, PODE_ATENDER, "Finalizada → Entregue"),
      },
    );
