import { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';
import type { Veiculo as VeiculoLinha } from '@infrastructure/persistence/generated/client';

/** `restaurar` revalida a placa: linha corrompida no banco falha aqui, não adiante. */
export function paraDominio(linha: VeiculoLinha): Veiculo {
  return Veiculo.restaurar(linha);
}

export function paraLinha(veiculo: Veiculo): VeiculoLinha {
  return {
    id: veiculo.id,
    clienteId: veiculo.clienteId,
    placa: veiculo.placa.valor,
    marca: veiculo.marca,
    modelo: veiculo.modelo,
    ano: veiculo.ano,
  };
}
