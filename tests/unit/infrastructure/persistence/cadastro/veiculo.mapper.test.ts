import { describe, expect, it } from 'bun:test';
import { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import { DomainError } from '@domain/core/domain-error';
import * as VeiculoMapper from '@infrastructure/persistence/cadastro/veiculo/veiculo.mapper';

describe('VeiculoMapper', () => {
  it('ida e volta preserva o agregado, com a placa normalizada', () => {
    const veiculo = Veiculo.registrar({ clienteId: 'c1', placa: 'abc-1d23', marca: 'VW', modelo: 'Gol', ano: 2020 });
    const linha = VeiculoMapper.paraLinha(veiculo);
    expect(linha).toEqual({ id: veiculo.id, clienteId: 'c1', placa: 'ABC1D23', marca: 'VW', modelo: 'Gol', ano: 2020 });

    const restaurado = VeiculoMapper.paraDominio(linha);
    expect(restaurado.equals(veiculo)).toBe(true);
    expect(restaurado.placa.valor).toBe('ABC1D23');
    expect(restaurado.puxarEventos()).toEqual([]);
  });

  it('placa inválida na linha falha na leitura', () => {
    const linha = { id: 'v1', clienteId: 'c1', placa: '123', marca: 'VW', modelo: 'Gol', ano: 2020 };
    expect(() => VeiculoMapper.paraDominio(linha)).toThrow(DomainError);
  });
});
