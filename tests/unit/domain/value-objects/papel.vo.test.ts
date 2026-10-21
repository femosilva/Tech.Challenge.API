import { describe, expect, it } from 'bun:test';
import { ehPapel, PAPEIS } from '@domain/value-objects/papel.vo';

describe('Papel', () => {
  it('lista os três papéis do sistema', () => {
    expect([...PAPEIS]).toEqual(['ATENDENTE', 'MECANICO', 'ADMINISTRADOR']);
  });

  it.each([...PAPEIS])('reconhece %p', (papel) => {
    expect(ehPapel(papel)).toBe(true);
  });

  it.each(['GERENTE', 'atendente', '', 'toString'])('rejeita %p', (valor) => {
    expect(ehPapel(valor)).toBe(false);
  });
});
