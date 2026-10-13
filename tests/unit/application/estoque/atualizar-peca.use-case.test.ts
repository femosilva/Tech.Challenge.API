import { beforeEach, describe, expect, test } from 'bun:test';
import { NaoEncontradoError } from '@application/core/erros';
import { AtualizarPeca } from '@application/estoque/atualizar-peca.use-case';
import { DomainError } from '@domain/core/domain-error';
import { Peca } from '@domain/estoque/peca.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import { PublicadorEventosEmMemoria } from '../doubles/publicador-eventos-memoria.test';
import { PecaRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';

describe('AtualizarPeca', () => {
  let pecas: PecaRepositorioEmMemoria;
  let atualizar: AtualizarPeca;
  let peca: Peca;

  beforeEach(async () => {
    pecas = new PecaRepositorioEmMemoria();
    atualizar = new AtualizarPeca(pecas, new PublicadorEventosEmMemoria());
    peca = Peca.cadastrar({
      codigo: 'FO-01',
      nome: 'Filtro de óleo',
      preco: Dinheiro.deCentavos(3500),
      saldo: Quantidade.de(10),
    });
    await pecas.salvar(peca);
  });

  test('atualiza nome e preço sem mexer em código nem saldo', async () => {
    await atualizar.executar({ id: peca.id, nome: 'Filtro de óleo premium', precoCentavos: 4200 });

    const salva = (await pecas.buscarPorId({ id: peca.id }))!;
    expect(salva.nome).toBe('Filtro de óleo premium');
    expect(salva.preco.centavos).toBe(4200);
    expect(salva.codigo).toBe('FO-01');
    expect(salva.saldo.valor).toBe(10);
  });

  test('peça inexistente vira NaoEncontradoError', async () => {
    await expect(atualizar.executar({ id: 'nao-existe', nome: 'X' })).rejects.toBeInstanceOf(NaoEncontradoError);
  });

  test('dado inválido vira DomainError e nada muda', async () => {
    await expect(atualizar.executar({ id: peca.id, nome: 'Novo', precoCentavos: -1 })).rejects.toBeInstanceOf(
      DomainError,
    );
    expect((await pecas.buscarPorId({ id: peca.id }))!.nome).toBe('Filtro de óleo');
  });
});
