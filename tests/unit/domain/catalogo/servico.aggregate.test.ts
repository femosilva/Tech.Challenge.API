// tests/unit/domain/catalogo/servico.aggregate.test.ts
import { describe, expect, it } from 'bun:test';
import { Servico } from '@domain/catalogo/servico.aggregate';
import { DomainError } from '@domain/core/domain-error';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';

const preco = Dinheiro.deCentavos(12000);

describe('Servico', () => {
  it('cadastra, normaliza o nome e emite ServicoCadastrado', () => {
    const agora = new Date(2026, 0, 1);
    const servico = Servico.cadastrar({ nome: '  Troca de óleo ', preco }, agora);
    expect(servico.nome).toBe('Troca de óleo');
    expect(servico.preco.equals(preco)).toBe(true);
    expect(servico.puxarEventos()).toEqual([
      { nome: 'ServicoCadastrado', ocorridoEm: agora, servicoId: servico.id },
    ]);
  });

  it('exige nome e preço maior que zero', () => {
    expect(() => Servico.cadastrar({ nome: '  ', preco })).toThrow(DomainError);
    expect(() => Servico.cadastrar({ nome: 'Alinhamento', preco: Dinheiro.zero() })).toThrow(DomainError);
  });

  it('atualiza só os campos informados', () => {
    const servico = Servico.cadastrar({ nome: 'Alinhamento', preco });
    servico.atualizar({ preco: Dinheiro.deCentavos(15000) });
    expect(servico.nome).toBe('Alinhamento');
    expect(servico.preco.centavos).toBe(15000);
    servico.atualizar({ nome: ' Alinhamento 3D ' });
    expect(servico.nome).toBe('Alinhamento 3D');
  });

  it('não altera nada quando um dos campos é inválido', () => {
    const servico = Servico.cadastrar({ nome: 'Alinhamento', preco });
    expect(() => servico.atualizar({ nome: 'Novo', preco: Dinheiro.zero() })).toThrow(DomainError);
    expect(servico.nome).toBe('Alinhamento');
    expect(servico.preco.equals(preco)).toBe(true);
  });

  it('restaura sem eventos e compara por identidade', () => {
    const a = Servico.restaurar({ id: 's1', nome: 'A', preco });
    expect(a.puxarEventos()).toEqual([]);
    expect(a.equals(Servico.restaurar({ id: 's1', nome: 'B', preco }))).toBe(true);
    expect(a.equals(Servico.restaurar({ id: 's2', nome: 'A', preco }))).toBe(false);
  });
});
