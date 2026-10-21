import { describe, expect, it } from 'bun:test';
import { DomainError } from '@domain/core/domain-error';
import { ItemPeca } from '@domain/ordem-servico/item-peca.vo';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';

const dados = { pecaId: 'p1', quantidade: Quantidade.de(3), precoUnitario: Dinheiro.deCentavos(2500) };

describe('ItemPeca', () => {
  it('guarda peça, quantidade e preço copiado, e o total é quantidade vezes preço', () => {
    const item = ItemPeca.criar(dados);
    expect(item.pecaId).toBe('p1');
    expect(item.quantidade.valor).toBe(3);
    expect(item.precoUnitario.centavos).toBe(2500);
    expect(item.total.centavos).toBe(7500);
  });

  it('exige a peça e quantidade maior que zero', () => {
    expect(() => ItemPeca.criar({ ...dados, pecaId: '' })).toThrow(DomainError);
    expect(() => ItemPeca.criar({ ...dados, quantidade: Quantidade.zero() })).toThrow(DomainError);
  });

  it('compara por valor, inclusive os VOs de dentro', () => {
    const a = ItemPeca.criar(dados);
    expect(a.equals(ItemPeca.criar({ ...dados, quantidade: Quantidade.de(3) }))).toBe(true);
    expect(a.equals(ItemPeca.criar({ ...dados, quantidade: Quantidade.de(4) }))).toBe(false);
  });
});
