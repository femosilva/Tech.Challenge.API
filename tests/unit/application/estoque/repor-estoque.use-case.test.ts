import { beforeEach, describe, expect, test } from 'bun:test';
import { NaoEncontradoError } from '@application/core/erros';
import { ReporEstoque } from '@application/estoque/repor-estoque.use-case';
import { DomainError } from '@domain/core/domain-error';
import { Peca } from '@domain/estoque/peca.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import { PublicadorEventosEmMemoria } from '../doubles/publicador-eventos-memoria.test';
import { PecaRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';
describe('ReporEstoque', () => {
  let pecas: PecaRepositorioEmMemoria;
  let eventos: PublicadorEventosEmMemoria;
  let repor: ReporEstoque;
  let peca: Peca;

  beforeEach(async () => {
    pecas = new PecaRepositorioEmMemoria();
    eventos = new PublicadorEventosEmMemoria();
    repor = new ReporEstoque(pecas, eventos);
    peca = Peca.cadastrar({
      codigo: 'FO-01',
      nome: 'Filtro de óleo',
      preco: Dinheiro.deCentavos(3500),
      saldo: Quantidade.de(10),
    });
    await pecas.salvar(peca);
  });

  test('soma ao saldo e publica EstoqueReposto', async () => {
    await repor.executar({ id: peca.id, quantidade: 5 });

    expect((await pecas.buscarPorId({ id: peca.id }))!.saldo.valor).toBe(15);
    expect(eventos.nomes).toEqual(['EstoqueReposto']);
  });

  test('peça inexistente vira NaoEncontradoError', async () => {
    await expect(repor.executar({ id: 'nao-existe', quantidade: 1 })).rejects.toBeInstanceOf(NaoEncontradoError);
  });

  test.each([0, -3, 1.5])('quantidade %p vira DomainError e o saldo não muda', async (quantidade) => {
    await expect(repor.executar({ id: peca.id, quantidade })).rejects.toBeInstanceOf(DomainError);
    expect((await pecas.buscarPorId({ id: peca.id }))!.saldo.valor).toBe(10);
    expect(eventos.publicados).toHaveLength(0);
  });
});
