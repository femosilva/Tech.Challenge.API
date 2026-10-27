import type {
  AtualizarVeiculo,
  CadastrarVeiculo,
  ListarVeiculos,
  ObterVeiculo,
  RemoverVeiculo,
} from '@application/cadastro/veiculo';
import type { AuthGuard } from '@presentation/http/auth.guard';
import { criadoResposta, criado, detalhe, type Executa, idParams, semConteudo } from '@presentation/http/comum';
import { erroResposta } from '@presentation/http/erro.schema';
import { PODE_ADMINISTRAR, PODE_CADASTRAR, PODE_CONSULTAR } from '@presentation/http/papeis';
import { Elysia, t } from 'elysia';
import { atualizarVeiculoBody, cadastrarVeiculoBody, veiculoResposta } from './veiculo.schema';

export type CasosVeiculos = {
  cadastrarVeiculo: Executa<CadastrarVeiculo>;
  atualizarVeiculo: Executa<AtualizarVeiculo>;
  listarVeiculos: Executa<ListarVeiculos>;
  obterVeiculo: Executa<ObterVeiculo>;
  removerVeiculo: Executa<RemoverVeiculo>;
};

export const veiculosRoutes = (casos: CasosVeiculos, guard: AuthGuard) =>
  new Elysia({ prefix: '/veiculos' })
    .use(guard)
    .post('', async ({ body, request, set }) => criado({ request, set }, await casos.cadastrarVeiculo.executar(body)), {
      papeis: PODE_CADASTRAR,
      body: cadastrarVeiculoBody,
      response: { 201: criadoResposta, 400: erroResposta, 409: erroResposta, 422: erroResposta },
      detail: detalhe('Veículos', PODE_CADASTRAR, 'Cadastra um veículo de um cliente'),
    })
    .get('', () => casos.listarVeiculos.executar(), {
      papeis: PODE_CONSULTAR,
      response: { 200: t.Array(veiculoResposta) },
      detail: detalhe('Veículos', PODE_CONSULTAR, 'Lista os veículos'),
    })
    .get('/:id', ({ params }) => casos.obterVeiculo.executar(params), {
      papeis: PODE_CONSULTAR,
      params: idParams,
      response: { 200: veiculoResposta, 404: erroResposta },
      detail: detalhe('Veículos', PODE_CONSULTAR, 'Detalha um veículo'),
    })
    .patch(
      '/:id',
      async ({ params, body, set }) => {
        await casos.atualizarVeiculo.executar({ id: params.id, ...body });
        semConteudo(set);
      },
      {
        papeis: PODE_CADASTRAR,
        params: idParams,
        body: atualizarVeiculoBody,
        response: { 204: t.Void(), 400: erroResposta, 404: erroResposta, 422: erroResposta },
        detail: detalhe('Veículos', PODE_CADASTRAR, 'Atualiza marca, modelo ou ano (placa e cliente não mudam)'),
      },
    )
    .delete(
      '/:id',
      async ({ params, set }) => {
        await casos.removerVeiculo.executar(params);
        semConteudo(set);
      },
      {
        papeis: PODE_ADMINISTRAR,
        params: idParams,
        response: { 204: t.Void(), 404: erroResposta, 409: erroResposta },
        detail: detalhe('Veículos', PODE_ADMINISTRAR, 'Remove um veículo sem ordens de serviço'),
      },
    );
