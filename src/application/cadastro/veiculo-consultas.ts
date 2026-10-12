import type { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';

export interface VeiculoConsultas {
  existePorCliente(filtro: Pick<Veiculo, 'clienteId'>): Promise<boolean>;
}
