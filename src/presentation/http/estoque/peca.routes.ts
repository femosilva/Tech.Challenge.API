import type {
  AtualizarPeca,
  CadastrarPeca,
  ListarPecas,
  ObterPeca,
  RemoverPeca,
  ReporEstoque,
} from '@application/estoque';
import type { AuthGuard } from '@presentation/http/auth.guard';
import { criadoResposta, criado, detalhe, type Executa, idParams, semConteudo } from '@presentation/http/comum';
import { erroResposta } from '@presentation/http/erro.schema';
import { PODE_ADMINISTRAR, PODE_CONSULTAR } from '@presentation/http/papeis';
import { Elysia, t } from 'elysia';
import { atualizarPecaBody, cadastrarPecaBody, pecaResposta, reporEstoqueBody } from './peca.schema';

export type CasosPecas = {
  cadastrarPeca: Executa<CadastrarPeca>;
  atualizarPeca: Executa<AtualizarPeca>;
  listarPecas: Executa<ListarPecas>;
  obterPeca: Executa<ObterPeca>;
  removerPeca: Executa<RemoverPeca>;
  reporEstoque: Executa<ReporEstoque>;
};

export const pecasRoutes = (casos: CasosPecas, guard: AuthGuard) =>
  new Elysia({ prefix: '/pecas' })
    .use(guard)
    .post('', async ({ body, request, set }) => criado({ request, set }, await casos.cadastrarPeca.executar(body)), {
      papeis: PODE_ADMINISTRAR,
      body: cadastrarPecaBody,
      response: { 201: criadoResposta, 400: erroResposta, 409: erroResposta, 422: erroResposta },
      detail: detalhe('Peças', PODE_ADMINISTRAR, 'Cadastra uma peça ou insumo, com saldo inicial opcional'),
    })
    .get('', () => casos.listarPecas.executar(), {
      papeis: PODE_CONSULTAR,
      response: { 200: t.Array(pecaResposta) },
      detail: detalhe('Peças', PODE_CONSULTAR, 'Lista as peças e o saldo em estoque'),
    })
    .get('/:id', ({ params }) => casos.obterPeca.executar(params), {
      papeis: PODE_CONSULTAR,
      params: idParams,
      response: { 200: pecaResposta, 404: erroResposta },
      detail: detalhe('Peças', PODE_CONSULTAR, 'Detalha uma peça'),
    })
    .patch(
      '/:id',
      async ({ params, body, set }) => {
        await casos.atualizarPeca.executar({ id: params.id, ...body });
        semConteudo(set);
      },
      {
        papeis: PODE_ADMINISTRAR,
        params: idParams,
        body: atualizarPecaBody,
        response: { 204: t.Void(), 400: erroResposta, 404: erroResposta, 422: erroResposta },
        detail: detalhe('Peças', PODE_ADMINISTRAR, 'Atualiza nome ou preço (código e saldo não mudam por aqui)'),
      },
    )
    .delete(
      '/:id',
      async ({ params, set }) => {
        await casos.removerPeca.executar(params);
        semConteudo(set);
      },
      {
        papeis: PODE_ADMINISTRAR,
        params: idParams,
        response: { 204: t.Void(), 404: erroResposta, 409: erroResposta },
        detail: detalhe('Peças', PODE_ADMINISTRAR, 'Remove uma peça que nunca foi usada em ordens de serviço'),
      },
    )
    .post(
      '/:id/reposicoes',
      async ({ params, body, set }) => {
        await casos.reporEstoque.executar({ id: params.id, quantidade: body.quantidade });
        semConteudo(set);
      },
      {
        papeis: PODE_ADMINISTRAR,
        params: idParams,
        body: reporEstoqueBody,
        response: { 204: t.Void(), 400: erroResposta, 404: erroResposta, 422: erroResposta },
        detail: detalhe('Peças', PODE_ADMINISTRAR, 'Repõe estoque: soma a quantidade ao saldo da peça'),
      },
    );
