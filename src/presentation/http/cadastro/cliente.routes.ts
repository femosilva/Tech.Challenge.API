import type { CadastrarCliente, ListarClientes, ObterCliente, RemoverCliente, RenomearCliente } from '@application/cadastro/cliente';
import type { ListarVeiculosDoCliente } from '@application/cadastro/veiculo';
import type { AuthGuard } from '@presentation/http/auth.guard';
import { criadoResposta, criado, detalhe, type Executa, idParams, semConteudo } from '@presentation/http/comum';
import { erroResposta } from '@presentation/http/erro.schema';
import { PODE_ADMINISTRAR, PODE_CADASTRAR, PODE_CONSULTAR } from '@presentation/http/papeis';
import { Elysia, t } from 'elysia';
import { cadastrarClienteBody, clienteResposta, renomearClienteBody } from './cliente.schema';
import { veiculoResposta } from './veiculo.schema';

export type CasosClientes = {
  cadastrarCliente: Executa<CadastrarCliente>;
  renomearCliente: Executa<RenomearCliente>;
  listarClientes: Executa<ListarClientes>;
  obterCliente: Executa<ObterCliente>;
  removerCliente: Executa<RemoverCliente>;
  listarVeiculosDoCliente: Executa<ListarVeiculosDoCliente>;
};

export const clientesRoutes = (casos: CasosClientes, guard: AuthGuard) =>
  new Elysia({ prefix: '/clientes' })
    .use(guard)
    .post('', async ({ body, request, set }) => criado({ request, set }, await casos.cadastrarCliente.executar(body)), {
      papeis: PODE_CADASTRAR,
      body: cadastrarClienteBody,
      response: { 201: criadoResposta, 400: erroResposta, 409: erroResposta, 422: erroResposta },
      detail: detalhe('Clientes', PODE_CADASTRAR, 'Cadastra um cliente'),
    })
    .get('', () => casos.listarClientes.executar(), {
      papeis: PODE_CONSULTAR,
      response: { 200: t.Array(clienteResposta) },
      detail: detalhe('Clientes', PODE_CONSULTAR, 'Lista os clientes'),
    })
    .get('/:id', ({ params }) => casos.obterCliente.executar(params), {
      papeis: PODE_CONSULTAR,
      params: idParams,
      response: { 200: clienteResposta, 404: erroResposta },
      detail: detalhe('Clientes', PODE_CONSULTAR, 'Detalha um cliente'),
    })
    .patch(
      '/:id',
      async ({ params, body, set }) => {
        await casos.renomearCliente.executar({ id: params.id, nome: body.nome });
        semConteudo(set);
      },
      {
        papeis: PODE_CADASTRAR,
        params: idParams,
        body: renomearClienteBody,
        response: { 204: t.Void(), 400: erroResposta, 404: erroResposta, 422: erroResposta },
        detail: detalhe('Clientes', PODE_CADASTRAR, 'Renomeia um cliente'),
      },
    )
    .delete(
      '/:id',
      async ({ params, set }) => {
        await casos.removerCliente.executar(params);
        semConteudo(set);
      },
      {
        papeis: PODE_ADMINISTRAR,
        params: idParams,
        response: { 204: t.Void(), 404: erroResposta, 409: erroResposta },
        detail: detalhe('Clientes', PODE_ADMINISTRAR, 'Remove um cliente sem veículos nem ordens de serviço'),
      },
    )
    .get('/:id/veiculos', ({ params }) => casos.listarVeiculosDoCliente.executar({ clienteId: params.id }), {
      papeis: PODE_CONSULTAR,
      params: idParams,
      response: { 200: t.Array(veiculoResposta), 404: erroResposta },
      detail: detalhe('Clientes', PODE_CONSULTAR, 'Lista os veículos de um cliente'),
    });
