// tests/unit/domain/cadastro/veiculo/veiculo.aggregate.test.ts
import { describe, expect, it } from 'bun:test';
import { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import { DomainError } from '@domain/core/domain-error';

const agora = new Date(2026, 0, 1);
const dados = { clienteId: 'c1', placa: 'ABC1D23', marca: 'Fiat', modelo: 'Uno', ano: 2015 };

describe('Veiculo', () => {
  it('registra, normaliza a placa e emite VeiculoRegistrado', () => {
    const veiculo = Veiculo.registrar({ ...dados, placa: 'abc-1d23', marca: ' Fiat ' }, agora);
    expect(veiculo.placa.valor).toBe('ABC1D23');
    expect(veiculo.marca).toBe('Fiat');
    expect(veiculo.puxarEventos()).toEqual([
      { nome: 'VeiculoRegistrado', ocorridoEm: agora, veiculoId: veiculo.id, clienteId: 'c1' },
    ]);
  });

  it('exige cliente, placa válida, marca e modelo', () => {
    expect(() => Veiculo.registrar({ ...dados, clienteId: '' })).toThrow(DomainError);
    expect(() => Veiculo.registrar({ ...dados, placa: 'XX' })).toThrow(DomainError);
    expect(() => Veiculo.registrar({ ...dados, marca: ' ' })).toThrow(DomainError);
    expect(() => Veiculo.registrar({ ...dados, modelo: '' })).toThrow(DomainError);
  });

  it('valida o ano: de 1900 até o ano seguinte ao atual', () => {
    expect(Veiculo.registrar({ ...dados, ano: 2027 }, agora).ano).toBe(2027);
    expect(() => Veiculo.registrar({ ...dados, ano: 2028 }, agora)).toThrow(DomainError);
    expect(() => Veiculo.registrar({ ...dados, ano: 1899 }, agora)).toThrow(DomainError);
    expect(() => Veiculo.registrar({ ...dados, ano: 2015.5 }, agora)).toThrow(DomainError);
  });

  it('atualiza só os campos informados', () => {
    const veiculo = Veiculo.registrar(dados, agora);
    veiculo.atualizar({ modelo: ' Palio ' }, agora);
    expect(veiculo.modelo).toBe('Palio');
    expect(veiculo.marca).toBe('Fiat');
    expect(veiculo.ano).toBe(2015);
  });

  it('não altera nada quando um dos campos é inválido', () => {
    const veiculo = Veiculo.registrar(dados, agora);
    expect(() => veiculo.atualizar({ marca: 'VW', ano: 3000 }, agora)).toThrow(DomainError);
    expect(veiculo.marca).toBe('Fiat');
    expect(veiculo.ano).toBe(2015);
  });

  it('restaura sem eventos e compara por identidade', () => {
    const a = Veiculo.restaurar({ id: 'v1', ...dados });
    expect(a.puxarEventos()).toEqual([]);
    expect(a.equals(Veiculo.restaurar({ id: 'v1', ...dados, modelo: 'Outro' }))).toBe(true);
    expect(a.equals(Veiculo.restaurar({ id: 'v2', ...dados }))).toBe(false);
  });
});
