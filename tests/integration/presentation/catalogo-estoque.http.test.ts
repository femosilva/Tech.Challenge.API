import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { criarApiDeTeste } from '../support/api-http';
import { limparBanco, prisma } from '../support/banco-de-teste';
import { CPF_ANA, inserirOrdem } from '../support/dados-de-teste';

const INT_MAXIMO = 2_147_483_647;
const api = criarApiDeTeste();
const { requisitar } = api;

beforeEach(limparBanco);
afterAll(async () => {
  await api.encerrar();
  await prisma.$disconnect();
});

const criarServico = async (extra: object = {}) =>
  (await requisitar('POST', '/api/v1/servicos', { papel: 'ADMINISTRADOR', corpo: { nome: 'Troca de óleo', precoCentavos: 15000, ...extra } }))
    .corpo.id as string;

const criarPeca = async (extra: object = {}) =>
  (await requisitar('POST', '/api/v1/pecas', {
    papel: 'ADMINISTRADOR',
    corpo: { codigo: 'FO-001', nome: 'Filtro de óleo', precoCentavos: 4000, saldoInicial: 10, ...extra },
  })).corpo.id as string;

const saldoDe = async (id: string) => (await requisitar('GET', `/api/v1/pecas/${id}`, { papel: 'MECANICO' })).corpo.saldo as number;

/** Cliente e veículo existentes, para amarrar uma OS ao serviço ou à peça. */
async function clienteComVeiculo() {
  const clienteId = (await requisitar('POST', '/api/v1/clientes', { papel: 'ATENDENTE', corpo: { nome: 'Ana', documento: CPF_ANA } })).corpo.id;
  const veiculoId = (
    await requisitar('POST', '/api/v1/veiculos', {
      papel: 'ATENDENTE',
      corpo: { clienteId, placa: 'ABC1D23', marca: 'VW', modelo: 'Gol', ano: 2020 },
    })
  ).corpo.id;
  return { clienteId: clienteId as string, veiculoId: veiculoId as string };
}

describe('serviços (Postgres real)', () => {
  it('ciclo completo: cadastra, consulta pelo Location, lista, atualiza e remove', async () => {
    const criado = await requisitar('POST', '/api/v1/servicos', {
      papel: 'ADMINISTRADOR',
      corpo: { nome: '  Troca de óleo  ', precoCentavos: 15000 },
    });
    const { id } = criado.corpo;

    expect(criado.status).toBe(201);
    expect(criado.headers.get('location')).toBe(`/api/v1/servicos/${id}`);

    const esperado = { id, nome: 'Troca de óleo', precoCentavos: 15000 };
    expect((await requisitar('GET', criado.headers.get('location')!, { papel: 'MECANICO' })).corpo).toEqual(esperado);
    expect((await requisitar('GET', '/api/v1/servicos', { papel: 'ATENDENTE' })).corpo).toEqual([esperado]);

    const atualizado = await requisitar('PATCH', `/api/v1/servicos/${id}`, {
      papel: 'ADMINISTRADOR',
      corpo: { nome: 'Alinhamento', precoCentavos: 9000 },
    });
    expect(atualizado.status).toBe(204);
    expect(atualizado.corpo).toBeNull();
    expect((await requisitar('GET', `/api/v1/servicos/${id}`, { papel: 'ADMINISTRADOR' })).corpo).toEqual({
      id,
      nome: 'Alinhamento',
      precoCentavos: 9000,
    });

    expect((await requisitar('DELETE', `/api/v1/servicos/${id}`, { papel: 'ADMINISTRADOR' })).status).toBe(204);
    const depois = await requisitar('GET', `/api/v1/servicos/${id}`, { papel: 'ADMINISTRADOR' });
    expect(depois.status).toBe(404);
    expect(depois.corpo).toEqual({ erro: { codigo: 'NaoEncontradoError', mensagem: 'Serviço não encontrado' } });
  });

  it('regras do domínio: preço negativo ou zero e nome em branco dão 422 e nada é gravado', async () => {
    const postar = (corpo: object) => requisitar('POST', '/api/v1/servicos', { papel: 'ADMINISTRADOR', corpo });

    const negativo = await postar({ nome: 'A', precoCentavos: -1 });
    const zero = await postar({ nome: 'A', precoCentavos: 0 });
    const emBranco = await postar({ nome: '   ', precoCentavos: 100 });

    expect([negativo.status, zero.status, emBranco.status]).toEqual([422, 422, 422]);
    expect(negativo.corpo.erro.mensagem).toBe('Dinheiro deve ser um inteiro de centavos maior ou igual a zero');
    expect(zero.corpo.erro.mensagem).toBe('Preço do serviço deve ser maior que zero');
    expect(emBranco.corpo.erro.mensagem).toBe('Nome do serviço é obrigatório');
    expect(await prisma.servico.count()).toBe(0);
  });

  it('o teto do banco vira 400, nunca 500: acima de 2147483647 recusa e no limite aceita', async () => {
    const acima = await requisitar('POST', '/api/v1/servicos', { papel: 'ADMINISTRADOR', corpo: { nome: 'Caro', precoCentavos: INT_MAXIMO + 1 } });
    expect(acima.status).toBe(400);
    expect(await prisma.servico.count()).toBe(0);

    const id = await criarServico({ precoCentavos: INT_MAXIMO });
    expect((await requisitar('GET', `/api/v1/servicos/${id}`, { papel: 'ADMINISTRADOR' })).corpo.precoCentavos).toBe(INT_MAXIMO);
  });

  it('atualização inválida não altera nada, nem o campo válido que veio junto', async () => {
    const id = await criarServico();

    const resposta = await requisitar('PATCH', `/api/v1/servicos/${id}`, { papel: 'ADMINISTRADOR', corpo: { nome: 'Novo nome', precoCentavos: 0 } });

    expect(resposta.status).toBe(422);
    expect((await requisitar('GET', `/api/v1/servicos/${id}`, { papel: 'ADMINISTRADOR' })).corpo.nome).toBe('Troca de óleo');
  });

  it('serviço já usado em uma ordem de serviço não pode ser removido: 409 e continua lá', async () => {
    const servicoId = await criarServico();
    const { clienteId, veiculoId } = await clienteComVeiculo();
    await inserirOrdem({ clienteId, veiculoId, servicoId });

    const resposta = await requisitar('DELETE', `/api/v1/servicos/${servicoId}`, { papel: 'ADMINISTRADOR' });

    expect(resposta.status).toBe(409);
    expect(resposta.corpo.erro.mensagem).toBe('Serviço já foi utilizado em ordens de serviço');
    expect(await prisma.servico.count()).toBe(1);
  });

  it('só o administrador altera o catálogo: atendente e mecânico levam 403 e leem normalmente', async () => {
    const id = await criarServico();

    for (const papel of ['ATENDENTE', 'MECANICO'] as const) {
      const cadastro = await requisitar('POST', '/api/v1/servicos', { papel, corpo: { nome: 'Outro', precoCentavos: 100 } });
      const alteracao = await requisitar('PATCH', `/api/v1/servicos/${id}`, { papel, corpo: { precoCentavos: 1 } });
      const remocao = await requisitar('DELETE', `/api/v1/servicos/${id}`, { papel });
      const consulta = await requisitar('GET', `/api/v1/servicos/${id}`, { papel });

      expect([papel, cadastro.status, alteracao.status, remocao.status, consulta.status]).toEqual([papel, 403, 403, 403, 200]);
    }
    expect(await prisma.servico.count()).toBe(1);
    expect((await prisma.servico.findUniqueOrThrow({ where: { id } })).precoCentavos).toBe(15000);
  });

  it('id inexistente na URL é 404 em consulta, atualização e remoção', async () => {
    const consulta = await requisitar('GET', '/api/v1/servicos/nao-existe', { papel: 'ATENDENTE' });
    const atualizacao = await requisitar('PATCH', '/api/v1/servicos/nao-existe', { papel: 'ADMINISTRADOR', corpo: { nome: 'X' } });
    const remocao = await requisitar('DELETE', '/api/v1/servicos/nao-existe', { papel: 'ADMINISTRADOR' });

    expect([consulta.status, atualizacao.status, remocao.status]).toEqual([404, 404, 404]);
  });
});

describe('peças e estoque (Postgres real)', () => {
  it('ciclo completo: cadastra com saldo, repõe, atualiza sem mexer no saldo e remove', async () => {
    const criada = await requisitar('POST', '/api/v1/pecas', {
      papel: 'ADMINISTRADOR',
      corpo: { codigo: 'FO-001', nome: 'Filtro de óleo', precoCentavos: 4000, saldoInicial: 10 },
    });
    const { id } = criada.corpo;
    expect(criada.status).toBe(201);
    expect(criada.headers.get('location')).toBe(`/api/v1/pecas/${id}`);

    const esperada = { id, codigo: 'FO-001', nome: 'Filtro de óleo', precoCentavos: 4000, saldo: 10 };
    expect((await requisitar('GET', criada.headers.get('location')!, { papel: 'MECANICO' })).corpo).toEqual(esperada);
    expect((await requisitar('GET', '/api/v1/pecas', { papel: 'ATENDENTE' })).corpo).toEqual([esperada]);

    const reposicao = await requisitar('POST', `/api/v1/pecas/${id}/reposicoes`, { papel: 'ADMINISTRADOR', corpo: { quantidade: 5 } });
    expect(reposicao.status).toBe(204);
    expect(reposicao.corpo).toBeNull();
    expect(await saldoDe(id)).toBe(15);
    await requisitar('POST', `/api/v1/pecas/${id}/reposicoes`, { papel: 'ADMINISTRADOR', corpo: { quantidade: 5 } });
    expect(await saldoDe(id)).toBe(20);

    const atualizada = await requisitar('PATCH', `/api/v1/pecas/${id}`, { papel: 'ADMINISTRADOR', corpo: { nome: 'Filtro de ar', precoCentavos: 5000 } });
    expect(atualizada.status).toBe(204);
    expect((await requisitar('GET', `/api/v1/pecas/${id}`, { papel: 'ADMINISTRADOR' })).corpo).toEqual({
      ...esperada,
      nome: 'Filtro de ar',
      precoCentavos: 5000,
      saldo: 20,
    });

    expect((await requisitar('DELETE', `/api/v1/pecas/${id}`, { papel: 'ADMINISTRADOR' })).status).toBe(204);
    expect((await requisitar('GET', `/api/v1/pecas/${id}`, { papel: 'ADMINISTRADOR' })).status).toBe(404);
  });

  it('o saldo inicial é opcional e o padrão é zero', async () => {
    const id = (await requisitar('POST', '/api/v1/pecas', {
      papel: 'ADMINISTRADOR',
      corpo: { codigo: 'PA-002', nome: 'Pastilha', precoCentavos: 8000 },
    })).corpo.id;

    expect(await saldoDe(id)).toBe(0);
  });

  it('código repetido: 409 e só uma peça no banco', async () => {
    await criarPeca();

    const repetida = await requisitar('POST', '/api/v1/pecas', {
      papel: 'ADMINISTRADOR',
      corpo: { codigo: 'FO-001', nome: 'Outro filtro', precoCentavos: 100 },
    });

    expect(repetida.status).toBe(409);
    expect(repetida.corpo.erro).toEqual({ codigo: 'ConflitoError', mensagem: 'Já existe peça com este código' });
    expect(await prisma.peca.count()).toBe(1);
  });

  it('reposição inválida: zero e negativa dão 422, acima do teto do banco dá 400, inexistente 404, e o saldo não muda', async () => {
    const id = await criarPeca({ saldoInicial: 10 });
    const repor = (quantidade: number, alvo = id) =>
      requisitar('POST', `/api/v1/pecas/${alvo}/reposicoes`, { papel: 'ADMINISTRADOR', corpo: { quantidade } });

    const zero = await repor(0);
    const negativa = await repor(-5);
    const acima = await repor(INT_MAXIMO + 1);
    const inexistente = await repor(5, 'nao-existe');

    expect([zero.status, negativa.status, acima.status, inexistente.status]).toEqual([422, 422, 400, 404]);
    expect(zero.corpo.erro.mensagem).toBe('Quantidade de reposição deve ser maior que zero');
    expect(negativa.corpo.erro.mensagem).toBe('Quantidade deve ser um inteiro maior ou igual a zero');
    expect(await saldoDe(id)).toBe(10);
  });

  it('código e saldo não mudam por PATCH: enviá-los é 400 e a peça fica intacta', async () => {
    const id = await criarPeca();

    const comCodigo = await requisitar('PATCH', `/api/v1/pecas/${id}`, { papel: 'ADMINISTRADOR', corpo: { codigo: 'NOVO' } });
    const comSaldo = await requisitar('PATCH', `/api/v1/pecas/${id}`, { papel: 'ADMINISTRADOR', corpo: { nome: 'X', saldo: 999 } });

    expect([comCodigo.status, comSaldo.status]).toEqual([400, 400]);
    expect((await requisitar('GET', `/api/v1/pecas/${id}`, { papel: 'ADMINISTRADOR' })).corpo).toEqual({
      id,
      codigo: 'FO-001',
      nome: 'Filtro de óleo',
      precoCentavos: 4000,
      saldo: 10,
    });
  });

  it('o teto do banco vira 400, nunca 500, no preço e no saldo inicial', async () => {
    const preco = await requisitar('POST', '/api/v1/pecas', {
      papel: 'ADMINISTRADOR',
      corpo: { codigo: 'A', nome: 'A', precoCentavos: INT_MAXIMO + 1 },
    });
    const saldo = await requisitar('POST', '/api/v1/pecas', {
      papel: 'ADMINISTRADOR',
      corpo: { codigo: 'B', nome: 'B', precoCentavos: 1, saldoInicial: INT_MAXIMO + 1 },
    });

    expect([preco.status, saldo.status]).toEqual([400, 400]);
    expect(await prisma.peca.count()).toBe(0);
    const noLimite = await criarPeca({ codigo: 'C', saldoInicial: INT_MAXIMO });
    expect(await saldoDe(noLimite)).toBe(INT_MAXIMO);
  });

  it('peça já usada em uma ordem de serviço não pode ser removida: 409 e continua lá', async () => {
    const pecaId = await criarPeca();
    const { clienteId, veiculoId } = await clienteComVeiculo();
    await inserirOrdem({ clienteId, veiculoId, pecaId });

    const resposta = await requisitar('DELETE', `/api/v1/pecas/${pecaId}`, { papel: 'ADMINISTRADOR' });

    expect(resposta.status).toBe(409);
    expect(resposta.corpo.erro.mensagem).toBe('Peça já foi utilizada em ordens de serviço');
    expect(await prisma.peca.count()).toBe(1);
  });

  it('só o administrador cadastra, altera, remove e repõe: atendente e mecânico levam 403 e leem normalmente', async () => {
    const id = await criarPeca({ saldoInicial: 10 });

    for (const papel of ['ATENDENTE', 'MECANICO'] as const) {
      const cadastro = await requisitar('POST', '/api/v1/pecas', { papel, corpo: { codigo: 'Z', nome: 'Z', precoCentavos: 1 } });
      const alteracao = await requisitar('PATCH', `/api/v1/pecas/${id}`, { papel, corpo: { nome: 'X' } });
      const reposicao = await requisitar('POST', `/api/v1/pecas/${id}/reposicoes`, { papel, corpo: { quantidade: 50 } });
      const remocao = await requisitar('DELETE', `/api/v1/pecas/${id}`, { papel });
      const consulta = await requisitar('GET', `/api/v1/pecas/${id}`, { papel });

      expect([papel, cadastro.status, alteracao.status, reposicao.status, remocao.status, consulta.status]).toEqual([papel, 403, 403, 403, 403, 200]);
    }
    expect(await saldoDe(id)).toBe(10);
    expect(await prisma.peca.count()).toBe(1);
  });

  it('id inexistente na URL é 404 em consulta, atualização e remoção', async () => {
    const consulta = await requisitar('GET', '/api/v1/pecas/nao-existe', { papel: 'ATENDENTE' });
    const atualizacao = await requisitar('PATCH', '/api/v1/pecas/nao-existe', { papel: 'ADMINISTRADOR', corpo: { nome: 'X' } });
    const remocao = await requisitar('DELETE', '/api/v1/pecas/nao-existe', { papel: 'ADMINISTRADOR' });

    expect([consulta.status, atualizacao.status, remocao.status]).toEqual([404, 404, 404]);
  });

  // Lacuna conhecida, fora da Presentation: o domínio não limita o saldo, então somar duas reposições válidas
  // pode passar de 2147483647 e estourar o Int do Postgres (hoje vira 500). A correção é um teto no domínio.
  it.todo('reposição que faz o saldo passar do limite do banco deve ser recusada com 422 (hoje: 500)');
});
