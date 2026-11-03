import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { criarApiDeTeste } from '../support/api-http';
import { limparBanco, prisma } from '../support/banco-de-teste';
import { CPF_ANA, CPF_BIA, inserirOrdem } from '../support/dados-de-teste';

const CNPJ = '11.222.333/0001-81';
const api = criarApiDeTeste();
const { requisitar } = api;

beforeEach(limparBanco);
afterAll(async () => {
  await api.encerrar();
  await prisma.$disconnect();
});

const criarCliente = async (nome = 'Ana Souza', documento = CPF_ANA) =>
  (await requisitar('POST', '/api/v1/clientes', { papel: 'ATENDENTE', corpo: { nome, documento } })).corpo.id as string;

const veiculoDe = (clienteId: string, extra: object = {}) => ({
  clienteId,
  placa: 'ABC1D23',
  marca: 'Volkswagen',
  modelo: 'Gol',
  ano: 2020,
  ...extra,
});
const criarVeiculo = async (clienteId: string, extra: object = {}) =>
  (await requisitar('POST', '/api/v1/veiculos', { papel: 'ATENDENTE', corpo: veiculoDe(clienteId, extra) })).corpo.id as string;

describe('clientes (Postgres real)', () => {
  it('ciclo completo: cadastra, consulta pelo Location, lista, renomeia e remove', async () => {
    const criado = await requisitar('POST', '/api/v1/clientes', {
      papel: 'ATENDENTE',
      corpo: { nome: '  Ana Souza  ', documento: CPF_ANA },
    });
    const { id } = criado.corpo;

    expect(criado.status).toBe(201);
    expect(criado.headers.get('location')).toBe(`/api/v1/clientes/${id}`);

    const detalhe = await requisitar('GET', criado.headers.get('location')!, { papel: 'MECANICO' });
    expect(detalhe.status).toBe(200);
    expect(detalhe.corpo).toEqual({ id, nome: 'Ana Souza', documento: '52998224725' });

    const lista = await requisitar('GET', '/api/v1/clientes', { papel: 'MECANICO' });
    expect(lista.corpo).toEqual([{ id, nome: 'Ana Souza', documento: '52998224725' }]);

    const renomeado = await requisitar('PATCH', `/api/v1/clientes/${id}`, { papel: 'ATENDENTE', corpo: { nome: ' Ana Maria ' } });
    expect(renomeado.status).toBe(204);
    expect(renomeado.corpo).toBeNull();
    expect((await requisitar('GET', `/api/v1/clientes/${id}`, { papel: 'ATENDENTE' })).corpo.nome).toBe('Ana Maria');

    const removido = await requisitar('DELETE', `/api/v1/clientes/${id}`, { papel: 'ADMINISTRADOR' });
    expect(removido.status).toBe(204);
    const depois = await requisitar('GET', `/api/v1/clientes/${id}`, { papel: 'ADMINISTRADOR' });
    expect(depois.status).toBe(404);
    expect(depois.corpo).toEqual({ erro: { codigo: 'NaoEncontradoError', mensagem: 'Cliente não encontrado' } });
  });

  it('aceita CNPJ e guarda o documento sem máscara', async () => {
    const id = await criarCliente('Oficina Ltda', CNPJ);

    const { corpo } = await requisitar('GET', `/api/v1/clientes/${id}`, { papel: 'ATENDENTE' });

    expect(corpo.documento).toBe('11222333000181');
  });

  it('documento inválido: 422; documento repetido, mesmo com outra máscara: 409', async () => {
    const invalido = await requisitar('POST', '/api/v1/clientes', {
      papel: 'ATENDENTE',
      corpo: { nome: 'Ana', documento: '111.111.111-11' },
    });
    await criarCliente('Ana', CPF_ANA);
    const repetido = await requisitar('POST', '/api/v1/clientes', {
      papel: 'ATENDENTE',
      corpo: { nome: 'Outra Ana', documento: '52998224725' },
    });

    expect(invalido.status).toBe(422);
    expect(invalido.corpo.erro).toEqual({ codigo: 'DomainError', mensagem: 'CPF ou CNPJ inválido' });
    expect(repetido.status).toBe(409);
    expect(repetido.corpo.erro.codigo).toBe('ConflitoError');
    expect((await requisitar('GET', '/api/v1/clientes', { papel: 'ATENDENTE' })).corpo).toHaveLength(1);
  });

  it('nome só com espaços passa pelo formato e é recusado pelo domínio: 422', async () => {
    const resposta = await requisitar('POST', '/api/v1/clientes', { papel: 'ATENDENTE', corpo: { nome: '   ', documento: CPF_ANA } });

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro.mensagem).toBe('Nome do cliente é obrigatório');
  });

  it('id inexistente na URL é 404 em consulta, renomeação e remoção', async () => {
    const consulta = await requisitar('GET', '/api/v1/clientes/nao-existe', { papel: 'ATENDENTE' });
    const renomeacao = await requisitar('PATCH', '/api/v1/clientes/nao-existe', { papel: 'ATENDENTE', corpo: { nome: 'Ana' } });
    const remocao = await requisitar('DELETE', '/api/v1/clientes/nao-existe', { papel: 'ADMINISTRADOR' });

    expect([consulta.status, renomeacao.status, remocao.status]).toEqual([404, 404, 404]);
  });

  it('o atendente não remove cliente: 403 e o cadastro continua lá', async () => {
    const id = await criarCliente();

    const resposta = await requisitar('DELETE', `/api/v1/clientes/${id}`, { papel: 'ATENDENTE' });

    expect(resposta.status).toBe(403);
    expect((await requisitar('GET', `/api/v1/clientes/${id}`, { papel: 'ATENDENTE' })).status).toBe(200);
  });

  it('sem token ou com token inválido: 401 e nada é gravado', async () => {
    const semToken = await requisitar('POST', '/api/v1/clientes', { corpo: { nome: 'Ana', documento: CPF_ANA } });

    expect(semToken.status).toBe(401);
    expect(await prisma.cliente.count()).toBe(0);
  });
});

describe('veículos (Postgres real)', () => {
  it('ciclo completo: cadastra, consulta, lista, atualiza e remove', async () => {
    const clienteId = await criarCliente();

    const criado = await requisitar('POST', '/api/v1/veiculos', { papel: 'ATENDENTE', corpo: veiculoDe(clienteId, { placa: 'abc-1d23' }) });
    const { id } = criado.corpo;
    expect(criado.status).toBe(201);
    expect(criado.headers.get('location')).toBe(`/api/v1/veiculos/${id}`);

    const esperado = { id, clienteId, placa: 'ABC1D23', marca: 'Volkswagen', modelo: 'Gol', ano: 2020 };
    expect((await requisitar('GET', criado.headers.get('location')!, { papel: 'MECANICO' })).corpo).toEqual(esperado);
    expect((await requisitar('GET', '/api/v1/veiculos', { papel: 'MECANICO' })).corpo).toEqual([esperado]);
    expect((await requisitar('GET', `/api/v1/clientes/${clienteId}/veiculos`, { papel: 'MECANICO' })).corpo).toEqual([esperado]);

    const atualizado = await requisitar('PATCH', `/api/v1/veiculos/${id}`, { papel: 'ATENDENTE', corpo: { marca: 'Fiat', ano: 2021 } });
    expect(atualizado.status).toBe(204);
    expect((await requisitar('GET', `/api/v1/veiculos/${id}`, { papel: 'ATENDENTE' })).corpo).toEqual({
      ...esperado,
      marca: 'Fiat',
      ano: 2021,
    });

    expect((await requisitar('DELETE', `/api/v1/veiculos/${id}`, { papel: 'ADMINISTRADOR' })).status).toBe(204);
    expect((await requisitar('GET', `/api/v1/veiculos/${id}`, { papel: 'ADMINISTRADOR' })).status).toBe(404);
  });

  it('cada cliente vê só os seus veículos', async () => {
    const ana = await criarCliente('Ana', CPF_ANA);
    const bia = await criarCliente('Bia', CPF_BIA);
    const veiculoAna = await criarVeiculo(ana, { placa: 'AAA1A11' });
    const veiculoBia = await criarVeiculo(bia, { placa: 'BBB2B22' });

    const daAna = await requisitar('GET', `/api/v1/clientes/${ana}/veiculos`, { papel: 'ATENDENTE' });
    const daBia = await requisitar('GET', `/api/v1/clientes/${bia}/veiculos`, { papel: 'ATENDENTE' });

    expect(daAna.corpo.map((v: { id: string }) => v.id)).toEqual([veiculoAna]);
    expect(daBia.corpo.map((v: { id: string }) => v.id)).toEqual([veiculoBia]);
  });

  it('regras do domínio e das referências: placa, ano, textos, cliente do corpo e placa repetida', async () => {
    const clienteId = await criarCliente();
    const postar = (extra: object) =>
      requisitar('POST', '/api/v1/veiculos', { papel: 'ATENDENTE', corpo: veiculoDe(clienteId, extra) });

    const placaInvalida = await postar({ placa: 'XX-123' });
    const anoAntigo = await postar({ ano: 1800 });
    const marcaEmBranco = await postar({ marca: '   ' });
    const clienteInexistente = await requisitar('POST', '/api/v1/veiculos', {
      papel: 'ATENDENTE',
      corpo: veiculoDe('nao-existe'),
    });
    await postar({});
    const placaRepetida = await postar({ placa: 'abc 1d23' });

    expect(placaInvalida.corpo.erro).toEqual({ codigo: 'DomainError', mensagem: 'Placa inválida' });
    expect(anoAntigo.corpo.erro.mensagem).toBe('Ano do veículo inválido');
    expect(marcaEmBranco.corpo.erro.mensagem).toBe('Marca é obrigatória');
    expect([placaInvalida.status, anoAntigo.status, marcaEmBranco.status]).toEqual([422, 422, 422]);
    // referência dentro do corpo é 422, não 404 (o 404 é só para o id da URL)
    expect(clienteInexistente.status).toBe(422);
    expect(clienteInexistente.corpo.erro.codigo).toBe('ReferenciaInvalidaError');
    expect(placaRepetida.status).toBe(409);
    expect(await prisma.veiculo.count()).toBe(1);
  });

  it('placa e cliente não mudam: enviá-los no PATCH é 400 e o veículo fica intacto', async () => {
    const clienteId = await criarCliente();
    const outro = await criarCliente('Bia', CPF_BIA);
    const id = await criarVeiculo(clienteId);

    const comPlaca = await requisitar('PATCH', `/api/v1/veiculos/${id}`, { papel: 'ATENDENTE', corpo: { marca: 'Fiat', placa: 'XYZ9A99' } });
    const comCliente = await requisitar('PATCH', `/api/v1/veiculos/${id}`, { papel: 'ATENDENTE', corpo: { clienteId: outro } });

    expect([comPlaca.status, comCliente.status]).toEqual([400, 400]);
    expect((await requisitar('GET', `/api/v1/veiculos/${id}`, { papel: 'ATENDENTE' })).corpo).toEqual({
      id,
      clienteId,
      placa: 'ABC1D23',
      marca: 'Volkswagen',
      modelo: 'Gol',
      ano: 2020,
    });
  });

  it('atualização inválida não altera nada, nem os campos válidos que vieram junto', async () => {
    const clienteId = await criarCliente();
    const id = await criarVeiculo(clienteId);

    const resposta = await requisitar('PATCH', `/api/v1/veiculos/${id}`, { papel: 'ATENDENTE', corpo: { marca: 'Fiat', ano: 1800 } });

    expect(resposta.status).toBe(422);
    expect((await requisitar('GET', `/api/v1/veiculos/${id}`, { papel: 'ATENDENTE' })).corpo.marca).toBe('Volkswagen');
  });

  it('vínculos protegem a remoção: cliente com veículo e veículo com OS dão 409 e nada some', async () => {
    const clienteId = await criarCliente();
    const veiculoId = await criarVeiculo(clienteId);

    const clienteComVeiculo = await requisitar('DELETE', `/api/v1/clientes/${clienteId}`, { papel: 'ADMINISTRADOR' });
    await inserirOrdem({ clienteId, veiculoId });
    const veiculoComOrdem = await requisitar('DELETE', `/api/v1/veiculos/${veiculoId}`, { papel: 'ADMINISTRADOR' });

    expect(clienteComVeiculo.status).toBe(409);
    expect(clienteComVeiculo.corpo.erro.mensagem).toBe('Cliente possui veículos');
    expect(veiculoComOrdem.status).toBe(409);
    expect(veiculoComOrdem.corpo.erro.mensagem).toBe('Veículo possui ordens de serviço');
    expect(await prisma.cliente.count()).toBe(1);
    expect(await prisma.veiculo.count()).toBe(1);
  });

  it('veículos de um cliente inexistente: 404; id de veículo inexistente: 404', async () => {
    const doCliente = await requisitar('GET', '/api/v1/clientes/nao-existe/veiculos', { papel: 'ATENDENTE' });
    const consulta = await requisitar('GET', '/api/v1/veiculos/nao-existe', { papel: 'ATENDENTE' });
    const remocao = await requisitar('DELETE', '/api/v1/veiculos/nao-existe', { papel: 'ADMINISTRADOR' });

    expect([doCliente.status, consulta.status, remocao.status]).toEqual([404, 404, 404]);
  });

  it('o mecânico consulta mas não cadastra, não altera e não remove', async () => {
    const clienteId = await criarCliente();
    const id = await criarVeiculo(clienteId);

    const cadastro = await requisitar('POST', '/api/v1/veiculos', { papel: 'MECANICO', corpo: veiculoDe(clienteId, { placa: 'ZZZ9Z99' }) });
    const alteracao = await requisitar('PATCH', `/api/v1/veiculos/${id}`, { papel: 'MECANICO', corpo: { marca: 'Fiat' } });
    const remocao = await requisitar('DELETE', `/api/v1/veiculos/${id}`, { papel: 'MECANICO' });
    const consulta = await requisitar('GET', `/api/v1/veiculos/${id}`, { papel: 'MECANICO' });

    expect([cadastro.status, alteracao.status, remocao.status, consulta.status]).toEqual([403, 403, 403, 200]);
    expect(consulta.corpo.marca).toBe('Volkswagen');
  });
});
