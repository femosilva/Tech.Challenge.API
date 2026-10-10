// tests/unit/domain/identidade/usuario.aggregate.test.ts
import { describe, expect, it } from 'bun:test';
import { DomainError } from '@domain/core/domain-error';
import { Usuario } from '@domain/identidade/usuario.aggregate';
import { PAPEIS } from '@domain/shared/value-objects/papel.vo';

const dados = { email: 'admin@oficina.com', senhaHash: '$argon2id$hash', papel: 'ADMINISTRADOR' };

describe('Usuario', () => {
  it('cria normalizando o e-mail e sem emitir eventos', () => {
    const usuario = Usuario.criar({ ...dados, email: '  Admin@Oficina.COM ' });
    expect(usuario.email).toBe('admin@oficina.com');
    expect(usuario.papel).toBe('ADMINISTRADOR');
    expect(usuario.senhaHash).toBe('$argon2id$hash');
    expect(usuario.id).toBeString();
    expect(usuario.puxarEventos()).toEqual([]);
  });

  it.each([...PAPEIS])('aceita o papel %p', (papel) => {
    expect(Usuario.criar({ ...dados, papel }).papel).toBe(papel);
  });

  it.each(['', '  ', 'x', 'a@b', '@oficina.com', 'a b@oficina.com'])('rejeita o e-mail %p', (email) => {
    expect(() => Usuario.criar({ ...dados, email })).toThrow(DomainError);
  });

  it('exige hash de senha', () => {
    expect(() => Usuario.criar({ ...dados, senhaHash: '' })).toThrow(DomainError);
    expect(() => Usuario.criar({ ...dados, senhaHash: '   ' })).toThrow(DomainError);
  });

  it('rejeita papel desconhecido', () => {
    expect(() => Usuario.criar({ ...dados, papel: 'GERENTE' })).toThrow('Papel inválido');
  });

  it('restaura validando o papel e compara por identidade', () => {
    const a = Usuario.restaurar({ id: 'u1', ...dados });
    expect(a.email).toBe('admin@oficina.com');
    expect(a.equals(Usuario.restaurar({ id: 'u1', ...dados, papel: 'MECANICO' }))).toBe(true);
    expect(a.equals(Usuario.restaurar({ id: 'u2', ...dados }))).toBe(false);
    expect(() => Usuario.restaurar({ id: 'u3', ...dados, papel: 'GERENTE' })).toThrow(DomainError);
  });
});
