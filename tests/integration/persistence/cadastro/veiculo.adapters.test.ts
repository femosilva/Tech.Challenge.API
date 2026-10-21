import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { ConflitoError } from '@application/core/erros';
import { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import { Placa } from '@domain/value-objects/placa.vo';
import { VeiculoConsultasAdapter } from '@infrastructure/persistence/cadastro/veiculo/veiculo-consultas.adapter';
import { VeiculoRepositoryAdapter } from '@infrastructure/persistence/cadastro/veiculo/veiculo-repository.adapter';
import { Prisma } from '@infrastructure/persistence/generated/client';
import { limparBanco, prisma } from '../../support/banco-de-teste';
import { CPF_BIA, inserirOrdem, salvarCliente } from '../../support/dados-de-teste';

const repo = new VeiculoRepositoryAdapter(prisma);
const consultas = new VeiculoConsultasAdapter(prisma);

const novoVeiculo = (clienteId: string, placa = 'abc-1d23') =>
  Veiculo.registrar({ clienteId, placa, marca: 'VW', modelo: 'Gol', ano: 2020 });

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

describe('VeiculoRepositoryAdapter', () => {
  it('salva e restaura o veículo com a placa normalizada', async () => {
    const ana = await salvarCliente();
    const veiculo = novoVeiculo(ana.id);
    await repo.salvar(veiculo);

    const lido = await repo.buscarPorId({ id: veiculo.id });
    expect(lido?.equals(veiculo)).toBe(true);
    expect(lido?.clienteId).toBe(ana.id);
    expect(lido?.placa.valor).toBe('ABC1D23');
  });

  it('salvar de novo atualiza em vez de duplicar', async () => {
    const ana = await salvarCliente();
    const veiculo = novoVeiculo(ana.id);
    await repo.salvar(veiculo);
    veiculo.atualizar({ marca: 'Fiat', ano: 2021 });
    await repo.salvar(veiculo);

    const lido = await repo.buscarPorId({ id: veiculo.id });
    expect([lido?.marca, lido?.ano]).toEqual(['Fiat', 2021]);
    expect(await prisma.veiculo.count()).toBe(1);
  });

  it('busca por placa e devolve null quando não existe', async () => {
    const ana = await salvarCliente();
    const veiculo = novoVeiculo(ana.id);
    await repo.salvar(veiculo);

    expect((await repo.buscarPorPlaca({ placa: Placa.criar('ABC1D23') }))?.id).toBe(veiculo.id);
    expect(await repo.buscarPorPlaca({ placa: Placa.criar('XYZ9876') })).toBeNull();
    expect(await repo.buscarPorId({ id: 'inexistente' })).toBeNull();
  });

  it('placa repetida (corrida entre duas requisições) vira ConflitoError', async () => {
    const ana = await salvarCliente();
    await repo.salvar(novoVeiculo(ana.id));

    expect(repo.salvar(novoVeiculo(ana.id))).rejects.toThrow(new ConflitoError('Já existe veículo com esta placa'));
  });

  it('cliente inexistente não vira conflito: o erro do banco sobe como veio', async () => {
    const erro = await repo.salvar(novoVeiculo('cliente-que-nao-existe')).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(erro).not.toBeInstanceOf(ConflitoError);
  });

  it('remove o veículo; remover de novo não falha', async () => {
    const ana = await salvarCliente();
    const veiculo = novoVeiculo(ana.id);
    await repo.salvar(veiculo);
    await repo.remover({ id: veiculo.id });
    await repo.remover({ id: veiculo.id });

    expect(await repo.buscarPorId({ id: veiculo.id })).toBeNull();
  });

  it('remover veículo com OS vira ConflitoError e preserva o veículo', async () => {
    const ana = await salvarCliente();
    const veiculo = novoVeiculo(ana.id);
    await repo.salvar(veiculo);
    await inserirOrdem({ clienteId: ana.id, veiculoId: veiculo.id });

    expect(repo.remover({ id: veiculo.id })).rejects.toThrow(new ConflitoError('Veículo possui ordens de serviço'));
    expect(await repo.buscarPorId({ id: veiculo.id })).not.toBeNull();
  });
});

describe('VeiculoConsultasAdapter', () => {
  it('lista por placa e devolve DTOs planos', async () => {
    const ana = await salvarCliente();
    await repo.salvar(novoVeiculo(ana.id, 'XYZ9876'));
    await repo.salvar(novoVeiculo(ana.id, 'ABC1D23'));

    const lista = await consultas.listar();
    expect(lista.map((v) => v.placa)).toEqual(['ABC1D23', 'XYZ9876']);
    expect(Object.keys(lista[0]!).sort()).toEqual(['ano', 'clienteId', 'id', 'marca', 'modelo', 'placa']);
  });

  it('obtém por id e devolve null quando não existe', async () => {
    const ana = await salvarCliente();
    const veiculo = novoVeiculo(ana.id);
    await repo.salvar(veiculo);

    expect(await consultas.obter({ id: veiculo.id })).toEqual({
      id: veiculo.id, clienteId: ana.id, placa: 'ABC1D23', marca: 'VW', modelo: 'Gol', ano: 2020,
    });
    expect(await consultas.obter({ id: 'inexistente' })).toBeNull();
  });

  it('lista só os veículos do cliente e informa se ele tem algum', async () => {
    const ana = await salvarCliente();
    const bia = await salvarCliente('Bia', CPF_BIA);
    await repo.salvar(novoVeiculo(ana.id, 'ABC1D23'));
    await repo.salvar(novoVeiculo(ana.id, 'XYZ9876'));

    expect((await consultas.listarPorCliente({ clienteId: ana.id })).map((v) => v.placa)).toEqual(['ABC1D23', 'XYZ9876']);
    expect(await consultas.listarPorCliente({ clienteId: bia.id })).toEqual([]);
    expect(await consultas.existePorCliente({ clienteId: ana.id })).toBe(true);
    expect(await consultas.existePorCliente({ clienteId: bia.id })).toBe(false);
  });
});
