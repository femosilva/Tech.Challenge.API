// tests/unit/domain/shared/value-objects/dinheiro.vo.test.ts
import { describe, expect, it } from 'bun:test';
import { DomainError } from '@domain/core/domain-error';
import { Dinheiro } from '@domain/shared/value-objects/dinheiro.vo';

describe('Dinheiro', () => {
  it('guarda o valor em centavos', () => {
    expect(Dinheiro.deCentavos(1550).centavos).toBe(1550);
    expect(Dinheiro.zero().ehZero()).toBe(true);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejeita %p', (valor) => {
    expect(() => Dinheiro.deCentavos(valor)).toThrow(DomainError);
  });

  it('soma e multiplica sem erro de ponto flutuante', () => {
    const preco = Dinheiro.deCentavos(1500);
    expect(preco.somar(preco).centavos).toBe(3000);
    expect(preco.multiplicar(3).centavos).toBe(4500);
    expect(Dinheiro.deCentavos(10).somar(Dinheiro.deCentavos(20)).centavos).toBe(30);
  });

  it('não permite resultado negativo ou fracionado ao multiplicar', () => {
    expect(() => Dinheiro.deCentavos(1500).multiplicar(-1)).toThrow(DomainError);
    expect(() => Dinheiro.deCentavos(1).multiplicar(0.5)).toThrow(DomainError);
  });

  it('é imutável: operar devolve um valor novo', () => {
    const original = Dinheiro.deCentavos(100);
    original.somar(Dinheiro.deCentavos(50));
    expect(original.centavos).toBe(100);
  });

  it('compara por valor', () => {
    expect(Dinheiro.deCentavos(100).equals(Dinheiro.deCentavos(100))).toBe(true);
    expect(Dinheiro.deCentavos(100).equals(Dinheiro.deCentavos(101))).toBe(false);
  });
});
