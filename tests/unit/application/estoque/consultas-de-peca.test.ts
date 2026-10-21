import { beforeEach, describe, expect, test } from 'bun:test';
import { NaoEncontradoError } from '@application/core/erros';
import { ListarPecas } from '@application/estoque/listar-pecas.use-case';
import { ObterPeca } from '@application/estoque/obter-peca.use-case';
import { Peca } from '@domain/estoque/peca.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import { PecaConsultasEmMemoria } from '../doubles/consultas-em-memoria';
import { PecaRepositorioEmMemoria } from '../doubles/repositorios-em-memoria.test';

describe('consultas de peça', () => {
  let pecas: PecaRepositorioEmMemoria;
  let obter: ObterPeca;
  let listar: ListarPecas;
  let filtro: Peca;

  beforeEach(async () => {
    pecas = new PecaRepositorioEmMemoria();
    const consultas = new PecaConsultasEmMemoria(pecas);
    obter = new ObterPeca(consultas);
    listar = new ListarPecas(consultas);
    filtro = Peca.cadastrar({
      codigo: 'FO-01',
      nome: 'Filtro de óleo',
      preco: Dinheiro.deCentavos(3500),
      saldo: Quantidade.de(10),
    });
    await pecas.salvar(filtro);
    await pecas.salvar(Peca.cadastrar({ codigo: 'PA-02', nome: 'Pastilha de freio', preco: Dinheiro.deCentavos(9000) }));
  });

  test('ObterPeca devolve o DTO com preço em centavos e saldo', async () => {
    expect(await obter.executar({ id: filtro.id })).toEqual({
      id: filtro.id,
      codigo: 'FO-01',
      nome: 'Filtro de óleo',
      precoCentavos: 3500,
      saldo: 10,
    });
  });

  test('ObterPeca com id inexistente vira NaoEncontradoError', async () => {
    await expect(obter.executar({ id: 'nao-existe' })).rejects.toBeInstanceOf(NaoEncontradoError);
  });

  test('ListarPecas devolve todas', async () => {
    expect((await listar.executar()).map((p) => p.codigo).sort()).toEqual(['FO-01', 'PA-02']);
  });
});
