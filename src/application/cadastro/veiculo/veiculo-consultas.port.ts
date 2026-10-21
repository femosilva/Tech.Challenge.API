import type { Veiculo } from '@domain/cadastro/veiculo/veiculo.aggregate';

export type VeiculoDto = Pick<Veiculo, 'id' | 'clienteId' | 'marca' | 'modelo' | 'ano'> & { placa: string };

export interface VeiculoConsultas {
  listar(): Promise<VeiculoDto[]>;
  obter(filtro: Pick<Veiculo, 'id'>): Promise<VeiculoDto | null>;
  listarPorCliente(filtro: Pick<Veiculo, 'clienteId'>): Promise<VeiculoDto[]>;
  existePorCliente(filtro: Pick<Veiculo, 'clienteId'>): Promise<boolean>;
}
