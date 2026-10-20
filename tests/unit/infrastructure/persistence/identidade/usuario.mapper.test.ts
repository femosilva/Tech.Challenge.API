import { describe, expect, it } from 'bun:test';
import { DomainError } from '@domain/core/domain-error';
import { Usuario } from '@domain/identidade/usuario.aggregate';
import * as UsuarioMapper from '@infrastructure/persistence/identidade/usuario.mapper';

describe('UsuarioMapper', () => {
  it('ida e volta preserva e-mail, hash e papel', () => {
    const usuario = Usuario.criar({ email: 'Admin@Oficina.com', senhaHash: 'hash', papel: 'ADMINISTRADOR' });
    const linha = UsuarioMapper.paraLinha(usuario);
    expect(linha).toEqual({ id: usuario.id, email: 'admin@oficina.com', senhaHash: 'hash', papel: 'ADMINISTRADOR' });
    expect(UsuarioMapper.paraDominio(linha).equals(usuario)).toBe(true);
  });

  it('papel desconhecido na linha falha na leitura', () => {
    const linha = { id: 'u1', email: 'a@b.com', senhaHash: 'hash', papel: 'ROOT' };
    expect(() => UsuarioMapper.paraDominio(linha)).toThrow(DomainError);
  });
});
