// tests/unit/domain/shared/value-objects/quantidade.vo.test.ts
import { describe, expect, it } from 'bun:test';
import { DomainError } from '@domain/core/domain-error';
import { Quantidade } from '@domain/shared/value-objects/quantidade.vo';

describe('Quantidade', () => {
  it('aceita inteiros a partir de zero', () => {
    expect(Quantidade.de(3).valor).toBe(3);
    expect(Quantidade.zero().ehZero()).toBe(true);
  });

  it.each([-1, 1.5, Number.NaN])('rejeita %p', (valor) => {
    expect(() => Quantidade.de(valor)).toThrow(DomainError);
  });

  it('soma e subtrai devolvendo um valor novo', () => {
    const tres = Quantidade.de(3);
    expect(tres.somar(Quantidade.de(2)).valor).toBe(5);
    expect(tres.subtrair(Quantidade.de(2)).valor).toBe(1);
    expect(tres.valor).toBe(3);
  });

  it('não subtrai além do que existe', () => {
    expect(() => Quantidade.de(1).subtrair(Quantidade.de(2))).toThrow(DomainError);
    expect(Quantidade.de(2).subtrair(Quantidade.de(2)).ehZero()).toBe(true);
  });

  it('compara', () => {
    expect(Quantidade.de(3).maiorQue(Quantidade.de(2))).toBe(true);
    expect(Quantidade.de(2).maiorQue(Quantidade.de(2))).toBe(false);
    expect(Quantidade.de(2).equals(Quantidade.de(2))).toBe(true);
    expect(Quantidade.de(2).equals(Quantidade.de(3))).toBe(false);
  });
});
