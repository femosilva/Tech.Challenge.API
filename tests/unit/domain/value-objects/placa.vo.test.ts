// tests/unit/domain/shared/value-objects/placa.vo.test.ts
import { describe, expect, it } from 'bun:test';
import { DomainError } from '@domain/core/domain-error';
import { Placa } from '@domain/value-objects/placa.vo';

describe('Placa', () => {
  it.each(['ABC1234', 'abc-1234', 'ABC1D23', 'abc 1d23'])('aceita %p', (entrada) => {
    expect(Placa.criar(entrada).valor).toMatch(/^[A-Z]{3}\d[A-Z0-9]\d{2}$/);
  });

  it.each(['AB1234', 'ABCD123', '1234ABC', 'ABC12345', 'ABC12D3', ''])('rejeita %p', (entrada) => {
    expect(() => Placa.criar(entrada)).toThrow(DomainError);
  });

  it('normaliza para maiúsculas, sem hífen nem espaço', () => {
    expect(Placa.criar('abc-1d23').valor).toBe('ABC1D23');
  });

  it('compara por valor, ignorando a máscara', () => {
    expect(Placa.criar('ABC-1234').equals(Placa.criar('abc1234'))).toBe(true);
    expect(Placa.criar('ABC1234').equals(Placa.criar('ABC1235'))).toBe(false);
  });
});
