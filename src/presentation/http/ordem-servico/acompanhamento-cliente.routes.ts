import type { ConsultarAndamento } from '@application/ordem-servico/acompanhamento';
import type { AprovarOrcamento, RejeitarOrcamento } from '@application/ordem-servico/criacao';
import { type Executa, idParams, semConteudo } from '@presentation/http/comum';
import { erroResposta } from '@presentation/http/erro.schema';
import { Elysia, t } from 'elysia';
import { detalheParaResposta } from './ordem-servico.mapper';
import { documentoHeaders, ordemServicoDetalheResposta } from './ordem-servico.schema';

const TAG = 'Acompanhamento do cliente';
const SEM_LOGIN =
  'Sem login: o cliente se identifica pelo número da OS (na URL) e pelo CPF ou CNPJ no cabeçalho X-Documento. ' +
  'OS inexistente e documento que não confere dão o mesmo 404.';

export type CasosAcompanhamentoCliente = {
  consultarAndamento: Executa<ConsultarAndamento>;
  aprovarOrcamento: Executa<AprovarOrcamento>;
  rejeitarOrcamento: Executa<RejeitarOrcamento>;
};

/** Rotas públicas (sem JWT): são as do cliente, que não tem usuário no sistema. */
export const acompanhamentoClienteRoutes = (casos: CasosAcompanhamentoCliente) =>
  new Elysia({ prefix: '/cliente/ordens-servico' })
    .get(
      '/:id',
      async ({ params, headers }) =>
        detalheParaResposta(await casos.consultarAndamento.executar({ id: params.id, documento: headers['x-documento'] })),
      {
        params: idParams,
        headers: documentoHeaders,
        response: { 200: ordemServicoDetalheResposta, 400: erroResposta, 404: erroResposta, 422: erroResposta },
        detail: { tags: [TAG], summary: 'O cliente acompanha o andamento da sua OS', description: SEM_LOGIN },
      },
    )
    .post(
      '/:id/orcamento/aprovar',
      async ({ params, headers, set }) => {
        await casos.aprovarOrcamento.executar({ id: params.id, documento: headers['x-documento'] });
        semConteudo(set);
      },
      {
        params: idParams,
        headers: documentoHeaders,
        response: { 204: t.Void(), 400: erroResposta, 404: erroResposta, 422: erroResposta },
        detail: {
          tags: [TAG],
          summary: 'O cliente aprova o orçamento: Aguardando aprovação → Em execução, com baixa de estoque',
          description: SEM_LOGIN,
        },
      },
    )
    .post(
      '/:id/orcamento/rejeitar',
      async ({ params, headers, set }) => {
        await casos.rejeitarOrcamento.executar({ id: params.id, documento: headers['x-documento'] });
        semConteudo(set);
      },
      {
        params: idParams,
        headers: documentoHeaders,
        response: { 204: t.Void(), 400: erroResposta, 404: erroResposta, 422: erroResposta },
        detail: {
          tags: [TAG],
          summary: 'O cliente rejeita o orçamento: a OS volta para Em diagnóstico',
          description: SEM_LOGIN,
        },
      },
    );
