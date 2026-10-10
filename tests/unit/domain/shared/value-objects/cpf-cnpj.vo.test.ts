// tests/unit/domain/shared/value-objects/cpf-cnpj.vo.test.ts
import { describe, expect, it } from 'bun:test';
import { DomainError } from '@domain/core/domain-error';
import { CpfCnpj } from '@domain/shared/value-objects/cpf-cnpj.vo';

describe('CpfCnpj', () => {
  it('aceita CPF com máscara e guarda só os dígitos', () => {
    const doc = CpfCnpj.criar('529.982.247-25');
    expect(doc.numero).toBe('52998224725');
    expect(doc.tipo).toBe('CPF');
  });

  it('aceita CNPJ numérico e alfanumérico, com ou sem máscara e em qualquer caixa', () => {
    expect(CpfCnpj.criar('11.222.333/0001-81').tipo).toBe('CNPJ');
    expect(CpfCnpj.criar('12.ABC.345/01DE-35').numero).toBe('12ABC34501DE35');
    expect(CpfCnpj.criar('12abc34501de35').numero).toBe('12ABC34501DE35');
  });

  it.each(['529.982.247-24', '111.111.111-11', '123', '', '12.ABC.345/01DE-36', '12.ABC.345/01DE-3A'])(
    'rejeita %p',
    (entrada) => expect(() => CpfCnpj.criar(entrada)).toThrow(DomainError),
  );

  it('compara por valor', () => {
    expect(CpfCnpj.criar('52998224725').equals(CpfCnpj.criar('529.982.247-25'))).toBe(true);
  });
});
