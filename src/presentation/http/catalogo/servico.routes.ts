import type {
  AtualizarServico,
  CadastrarServico,
  ListarServicos,
  ObterServico,
  RemoverServico,
} from '@application/catalogo';
import type { AuthGuard } from '@presentation/http/auth.guard';
import { criadoResposta, criado, detalhe, type Executa, idParams, semConteudo } from '@presentation/http/comum';
import { erroResposta } from '@presentation/http/erro.schema';
import { PODE_ADMINISTRAR, PODE_CONSULTAR } from '@presentation/http/papeis';
import { Elysia, t } from 'elysia';
import { atualizarServicoBody, cadastrarServicoBody, servicoResposta } from './servico.schema';

export type CasosServicos = {
  cadastrarServico: Executa<CadastrarServico>;
  atualizarServico: Executa<AtualizarServico>;
  listarServicos: Executa<ListarServicos>;
  obterServico: Executa<ObterServico>;
  removerServico: Executa<RemoverServico>;
};

export const servicosRoutes = (casos: CasosServicos, guard: AuthGuard) =>
  new Elysia({ prefix: '/servicos' })
    .use(guard)
    .post('', async ({ body, request, set }) => criado({ request, set }, await casos.cadastrarServico.executar(body)), {
      papeis: PODE_ADMINISTRAR,
      body: cadastrarServicoBody,
      response: { 201: criadoResposta, 400: erroResposta, 422: erroResposta },
      detail: detalhe('Serviços', PODE_ADMINISTRAR, 'Cadastra um serviço do catálogo'),
    })
    .get('', () => casos.listarServicos.executar(), {
      papeis: PODE_CONSULTAR,
      response: { 200: t.Array(servicoResposta) },
      detail: detalhe('Serviços', PODE_CONSULTAR, 'Lista os serviços'),
    })
    .get('/:id', ({ params }) => casos.obterServico.executar(params), {
      papeis: PODE_CONSULTAR,
      params: idParams,
      response: { 200: servicoResposta, 404: erroResposta },
      detail: detalhe('Serviços', PODE_CONSULTAR, 'Detalha um serviço'),
    })
    .patch(
      '/:id',
      async ({ params, body, set }) => {
        await casos.atualizarServico.executar({ id: params.id, ...body });
        semConteudo(set);
      },
      {
        papeis: PODE_ADMINISTRAR,
        params: idParams,
        body: atualizarServicoBody,
        response: { 204: t.Void(), 400: erroResposta, 404: erroResposta, 422: erroResposta },
        detail: detalhe('Serviços', PODE_ADMINISTRAR, 'Atualiza nome ou preço de um serviço'),
      },
    )
    .delete(
      '/:id',
      async ({ params, set }) => {
        await casos.removerServico.executar(params);
        semConteudo(set);
      },
      {
        papeis: PODE_ADMINISTRAR,
        params: idParams,
        response: { 204: t.Void(), 404: erroResposta, 409: erroResposta },
        detail: detalhe('Serviços', PODE_ADMINISTRAR, 'Remove um serviço que nunca foi usado em ordens de serviço'),
      },
    );
