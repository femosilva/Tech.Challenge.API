import { beforeEach, describe, expect, test } from 'bun:test';
import { ConflitoError } from '@application/core/erros';
import { CadastrarPeca } from '@application/estoque/cadastrar-peca.use-case';
import { DomainError } from '@domain/core/domain-error';
import { PublicadorEventosEmMemoria } from '../doubles/publicador-eventos-memoria.test';
import { PecaRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';

describe('CadastrarPeca', () => {
  let pecas: PecaRepositorioEmMemoria;
  let eventos: PublicadorEventosEmMemoria;
  let cadastrar: CadastrarPeca;

  beforeEach(() => {
    pecas = new PecaRepositorioEmMemoria();
    eventos = new PublicadorEventosEmMemoria();
    cadastrar = new CadastrarPeca(pecas, eventos);
  });

  test('cadastra sem saldo inicial: saldo zero e só PecaCadastrada', async () => {
    const { id } = await cadastrar.executar({ codigo: 'FO-01', nome: 'Filtro de óleo', precoCentavos: 3500 });

    const salva = (await pecas.buscarPorId({ id }))!;
    expect(salva.preco.centavos).toBe(3500);
    expect(salva.saldo.valor).toBe(0);
    expect(eventos.nomes).toEqual(['PecaCadastrada']);
  });

  test('cadastra com saldo inicial e publica também EstoqueReposto', async () => {
    const { id } = await cadastrar.executar({
      codigo: 'FO-01',
      nome: 'Filtro de óleo',
      precoCentavos: 3500,
      saldoInicial: 10,
    });

    expect((await pecas.buscarPorId({ id }))!.saldo.valor).toBe(10);
    expect(eventos.nomes).toEqual(['PecaCadastrada', 'EstoqueReposto']);
  });

  test('código repetido vira ConflitoError, mesmo com espaços', async () => {
    await cadastrar.executar({ codigo: 'FO-01', nome: 'Filtro de óleo', precoCentavos: 3500 });

    await expect(cadastrar.executar({ codigo: ' FO-01 ', nome: 'Outro', precoCentavos: 100 })).rejects.toBeInstanceOf(
      ConflitoError,
    );
    expect(eventos.publicados).toHaveLength(1);
  });

  test.each([
    ['preço negativo', { precoCentavos: -1 }],
    ['preço fracionado', { precoCentavos: 10.5 }],
    ['saldo negativo', { saldoInicial: -1 }],
    ['saldo fracionado', { saldoInicial: 1.5 }],
    ['código vazio', { codigo: ' ' }],
    ['nome vazio', { nome: ' ' }],
  ])('%s vira DomainError', async (_caso, invalido) => {
    const dados = { codigo: 'FO-01', nome: 'Filtro', precoCentavos: 100, ...invalido };
    await expect(cadastrar.executar(dados)).rejects.toBeInstanceOf(DomainError);
    expect(eventos.publicados).toHaveLength(0);
  });
});
