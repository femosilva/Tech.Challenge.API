import { describe, expect, it } from 'bun:test';
import { Peca } from '@domain/estoque/peca.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';
import * as PecaMapper from '@infrastructure/persistence/estoque/peca.mapper';

describe('PecaMapper', () => {
  it('ida e volta converte preço e saldo para primitivos e de volta', () => {
    const peca = Peca.cadastrar({ codigo: 'FIL-01', nome: 'Filtro', preco: Dinheiro.deCentavos(3500), saldo: Quantidade.de(8) });
    const linha = PecaMapper.paraLinha(peca);
    expect(linha).toEqual({ id: peca.id, codigo: 'FIL-01', nome: 'Filtro', precoCentavos: 3500, saldo: 8 });

    const restaurada = PecaMapper.paraDominio(linha);
    expect(restaurada.preco.centavos).toBe(3500);
    expect(restaurada.saldo.valor).toBe(8);
    expect(restaurada.puxarEventos()).toEqual([]);
  });
});
