import { describe, expect, it } from 'bun:test';
import { DomainError } from '@domain/core/domain-error';
import { ItemServico } from '@domain/ordem-servico/item-servico.vo';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';

const preco = Dinheiro.deCentavos(10000);

describe('ItemServico', () => {
  it('guarda o serviço e o preço copiado, e o total é o próprio preço', () => {
    const item = ItemServico.criar({ servicoId: 's1', precoUnitario: preco });
    expect(item.servicoId).toBe('s1');
    expect(item.precoUnitario.equals(preco)).toBe(true);
    expect(item.total.equals(preco)).toBe(true);
  });

  it('exige o serviço', () => {
    expect(() => ItemServico.criar({ servicoId: '', precoUnitario: preco })).toThrow(DomainError);
  });

  it('compara por valor', () => {
    const a = ItemServico.criar({ servicoId: 's1', precoUnitario: preco });
    expect(a.equals(ItemServico.criar({ servicoId: 's1', precoUnitario: Dinheiro.deCentavos(10000) }))).toBe(true);
    expect(a.equals(ItemServico.criar({ servicoId: 's2', precoUnitario: preco }))).toBe(false);
  });
});
