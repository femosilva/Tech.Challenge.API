import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { ConflitoError } from '@application/core/erros';
import { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import { Peca } from '@domain/estoque/peca.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import { VeiculoRepositoryAdapter } from '@infrastructure/persistence/cadastro/veiculo/veiculo-repository.adapter';
import { PecaConsultasAdapter } from '@infrastructure/persistence/estoque/peca-consultas.adapter';
import { PecaRepositoryAdapter } from '@infrastructure/persistence/estoque/peca-repository.adapter';
import { limparBanco, prisma } from '../../support/banco-de-teste';
import { inserirOrdem, salvarCliente } from '../../support/dados-de-teste';

const repo = new PecaRepositoryAdapter(prisma);
const consultas = new PecaConsultasAdapter(prisma);

const novaPeca = (codigo = 'FIL-01', nome = 'Filtro de óleo', saldo = 8) =>
  Peca.cadastrar({ codigo, nome, preco: Dinheiro.deCentavos(3500), saldo: Quantidade.de(saldo) });

beforeEach(limparBanco);
afterAll(() => prisma.$disconnect());

describe('PecaRepositoryAdapter', () => {
  it('salva e restaura a peça com preço e saldo como objetos de valor', async () => {
    const peca = novaPeca();
    await repo.salvar(peca);

    const lida = await repo.buscarPorId({ id: peca.id });
    expect(lida?.equals(peca)).toBe(true);
    expect([lida?.codigo, lida?.preco.centavos, lida?.saldo.valor]).toEqual(['FIL-01', 3500, 8]);
    expect(await repo.buscarPorId({ id: 'inexistente' })).toBeNull();
  });

  it('salvar de novo persiste o saldo novo em vez de duplicar', async () => {
    const peca = novaPeca();
    await repo.salvar(peca);
    peca.darBaixa(Quantidade.de(3));
    await repo.salvar(peca);

    expect((await repo.buscarPorId({ id: peca.id }))?.saldo.valor).toBe(5);
    expect(await prisma.peca.count()).toBe(1);
  });

  it('busca por código e devolve null quando não existe', async () => {
    const peca = novaPeca();
    await repo.salvar(peca);

    expect((await repo.buscarPorCodigo({ codigo: 'FIL-01' }))?.id).toBe(peca.id);
    expect(await repo.buscarPorCodigo({ codigo: 'NAO-EXISTE' })).toBeNull();
  });

  it('código repetido (corrida entre duas requisições) vira ConflitoError', async () => {
    await repo.salvar(novaPeca());

    expect(repo.salvar(novaPeca('FIL-01', 'Outro filtro'))).rejects.toThrow(
      new ConflitoError('Já existe peça com este código'),
    );
  });

  it('remove a peça; remover de novo não falha', async () => {
    const peca = novaPeca();
    await repo.salvar(peca);
    await repo.remover({ id: peca.id });
    await repo.remover({ id: peca.id });

    expect(await repo.buscarPorId({ id: peca.id })).toBeNull();
  });

  it('remover peça usada em OS vira ConflitoError e preserva a peça', async () => {
    const ana = await salvarCliente();
    const veiculo = Veiculo.registrar({ clienteId: ana.id, placa: 'ABC1D23', marca: 'VW', modelo: 'Gol', ano: 2020 });
    await new VeiculoRepositoryAdapter(prisma).salvar(veiculo);
    const peca = novaPeca();
    await repo.salvar(peca);
    await inserirOrdem({ clienteId: ana.id, veiculoId: veiculo.id, pecaId: peca.id });

    expect(repo.remover({ id: peca.id })).rejects.toThrow(new ConflitoError('Peça já foi utilizada em ordens de serviço'));
    expect(await repo.buscarPorId({ id: peca.id })).not.toBeNull();
  });
});

describe('PecaConsultasAdapter', () => {
  it('lista por nome com preço em centavos e saldo', async () => {
    await repo.salvar(novaPeca('VEL-01', 'Vela', 20));
    await repo.salvar(novaPeca('FIL-01', 'Filtro de óleo', 8));

    const lista = await consultas.listar();
    expect(lista.map((p) => p.codigo)).toEqual(['FIL-01', 'VEL-01']);
    expect(Object.keys(lista[0]!).sort()).toEqual(['codigo', 'id', 'nome', 'precoCentavos', 'saldo']);
    expect([lista[0]!.precoCentavos, lista[0]!.saldo]).toEqual([3500, 8]);
  });

  it('obtém por id e devolve null quando não existe', async () => {
    const peca = novaPeca();
    await repo.salvar(peca);

    expect(await consultas.obter({ id: peca.id })).toEqual({
      id: peca.id, codigo: 'FIL-01', nome: 'Filtro de óleo', precoCentavos: 3500, saldo: 8,
    });
    expect(await consultas.obter({ id: 'inexistente' })).toBeNull();
  });
});
