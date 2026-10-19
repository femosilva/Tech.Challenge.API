import { describe, expect, it } from 'bun:test';
import { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import { DomainError } from '@domain/core/domain-error';
import * as ClienteMapper from '@infrastructure/persistence/cadastro/cliente/cliente.mapper';

describe('ClienteMapper', () => {
  it('ida e volta preserva o agregado, com o documento normalizado', () => {
    const cliente = Cliente.cadastrar({ nome: 'Ana', documento: '529.982.247-25' });
    const linha = ClienteMapper.paraLinha(cliente);
    expect(linha).toEqual({ id: cliente.id, nome: 'Ana', documento: '52998224725' });
    expect(ClienteMapper.paraDominio(linha).equals(cliente)).toBe(true);
    expect(ClienteMapper.paraDominio(linha).documento.numero).toBe('52998224725');
  });

  it('restaurar não emite evento', () => {
    const linha = { id: 'c1', nome: 'Ana', documento: '52998224725' };
    expect(ClienteMapper.paraDominio(linha).puxarEventos()).toEqual([]);
  });

  it('documento inválido na linha falha na leitura', () => {
    expect(() => ClienteMapper.paraDominio({ id: 'c1', nome: 'Ana', documento: '123' })).toThrow(DomainError);
  });
});
