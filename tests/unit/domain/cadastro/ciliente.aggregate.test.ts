import { describe, expect, it } from 'bun:test';
import { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import { DomainError } from '@domain/core/domain-error';

const CPF = '529.982.247-25';

describe('Cliente', () => {
  it('cadastra, normaliza o nome e registra ClienteCadastrado', () => {
    const agora = new Date(2026, 0, 1);
    const cliente = Cliente.cadastrar({ nome: '  Maria  ', documento: CPF }, agora);
    expect(cliente.nome).toBe('Maria');
    expect(cliente.puxarEventos()).toEqual([
      { nome: 'ClienteCadastrado', ocorridoEm: agora, clienteId: cliente.id },
    ]);
    expect(cliente.puxarEventos()).toEqual([]);
  });

  it('exige nome e documento válido', () => {
    expect(() => Cliente.cadastrar({ nome: '   ', documento: CPF })).toThrow(DomainError);
    expect(() => Cliente.cadastrar({ nome: 'Maria', documento: '000' })).toThrow(DomainError);
  });

  it('renomeia validando', () => {
    const cliente = Cliente.cadastrar({ nome: 'Maria', documento: CPF });
    cliente.renomear(' Maria Silva ');
    expect(cliente.nome).toBe('Maria Silva');
    expect(() => cliente.renomear('')).toThrow(DomainError);
  });

  it('restaura sem eventos e compara por identidade', () => {
    const cliente = Cliente.restaurar({ id: 'c1', nome: 'Maria', documento: CPF });
    expect(cliente.puxarEventos()).toEqual([]);
    expect(cliente.equals(Cliente.restaurar({ id: 'c1', nome: 'Outro nome', documento: CPF }))).toBe(true);
    expect(cliente.equals(Cliente.restaurar({ id: 'c2', nome: 'Maria', documento: CPF }))).toBe(false);
  });
});
