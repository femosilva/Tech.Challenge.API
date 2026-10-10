// tests/unit/domain/estoque/peca.aggregate.test.ts
import { describe, expect, it } from 'bun:test';
import { DomainError } from '@domain/core/domain-error';
import { Peca } from '@domain/estoque/peca.aggregate';
import { Dinheiro } from '@domain/value-objects/dinheiro.vo';
import { Quantidade } from '@domain/value-objects/quantidade.vo';

const agora = new Date(2026, 0, 1);
const preco = Dinheiro.deCentavos(2500);
const dados = { codigo: 'OL-5W30', nome: 'Óleo 5W30', preco };

describe('Peca', () => {
  it('cadastra com saldo zero e emite PecaCadastrada', () => {
    const peca = Peca.cadastrar({ ...dados, codigo: ' OL-5W30 ', nome: ' Óleo 5W30 ' }, agora);
    expect(peca.codigo).toBe('OL-5W30');
    expect(peca.nome).toBe('Óleo 5W30');
    expect(peca.saldo.ehZero()).toBe(true);
    expect(peca.puxarEventos()).toEqual([{ nome: 'PecaCadastrada', ocorridoEm: agora, pecaId: peca.id }]);
  });

  it('cadastra com saldo inicial e emite também EstoqueReposto', () => {
    const peca = Peca.cadastrar({ ...dados, saldo: Quantidade.de(10) }, agora);
    expect(peca.saldo.valor).toBe(10);
    expect(peca.puxarEventos().map((e) => e.nome)).toEqual(['PecaCadastrada', 'EstoqueReposto']);
  });

  it('exige código e nome', () => {
    expect(() => Peca.cadastrar({ ...dados, codigo: ' ' })).toThrow(DomainError);
    expect(() => Peca.cadastrar({ ...dados, nome: '' })).toThrow(DomainError);
  });

  it('repõe e dá baixa, emitindo os eventos', () => {
    const peca = Peca.cadastrar({ ...dados, saldo: Quantidade.de(5) }, agora);
    peca.puxarEventos();
    peca.repor(Quantidade.de(3), agora);
    peca.darBaixa(Quantidade.de(4), agora);
    expect(peca.saldo.valor).toBe(4);
    expect(peca.puxarEventos()).toEqual([
      { nome: 'EstoqueReposto', ocorridoEm: agora, pecaId: peca.id, quantidade: 3 },
      { nome: 'EstoqueBaixado', ocorridoEm: agora, pecaId: peca.id, quantidade: 4 },
    ]);
  });

  it('permite baixar exatamente o saldo, deixando zero', () => {
    const peca = Peca.cadastrar({ ...dados, saldo: Quantidade.de(2) });
    peca.darBaixa(Quantidade.de(2));
    expect(peca.saldo.ehZero()).toBe(true);
  });

  it('nunca deixa o saldo ficar negativo e não emite evento na falha', () => {
    const peca = Peca.cadastrar({ ...dados, saldo: Quantidade.de(2) });
    peca.puxarEventos();
    expect(() => peca.darBaixa(Quantidade.de(3))).toThrow('Saldo insuficiente');
    expect(peca.saldo.valor).toBe(2);
    expect(peca.puxarEventos()).toEqual([]);
  });

  it('rejeita reposição e baixa de zero', () => {
    const peca = Peca.cadastrar({ ...dados, saldo: Quantidade.de(2) });
    expect(() => peca.repor(Quantidade.zero())).toThrow(DomainError);
    expect(() => peca.darBaixa(Quantidade.zero())).toThrow(DomainError);
  });

  it('atualiza nome e preço, mas nunca o código', () => {
    const peca = Peca.cadastrar(dados);
    peca.atualizar({ preco: Dinheiro.deCentavos(3000) });
    expect(peca.preco.centavos).toBe(3000);
    expect(peca.nome).toBe('Óleo 5W30');
    peca.atualizar({ nome: ' Óleo 0W20 ' });
    expect(peca.nome).toBe('Óleo 0W20');
    expect(peca.codigo).toBe('OL-5W30');
    expect(() => peca.atualizar({ nome: ' ' })).toThrow(DomainError);
    expect(peca.nome).toBe('Óleo 0W20');
  });

  it('restaura sem eventos e compara por identidade', () => {
    const a = Peca.restaurar({ id: 'p1', ...dados, saldo: Quantidade.de(7) });
    expect(a.saldo.valor).toBe(7);
    expect(a.puxarEventos()).toEqual([]);
    expect(a.equals(Peca.restaurar({ id: 'p1', ...dados, nome: 'Outro', saldo: Quantidade.zero() }))).toBe(true);
    expect(a.equals(Peca.restaurar({ id: 'p2', ...dados, saldo: Quantidade.de(7) }))).toBe(false);
  });
});
