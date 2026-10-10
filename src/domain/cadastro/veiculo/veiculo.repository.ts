import type { Veiculo } from './veiculo.aggregate';

export interface VeiculoRepository {
  buscarPorId(filtro: Pick<Veiculo, 'id'>): Promise<Veiculo | null>;
  buscarPorPlaca(filtro: Pick<Veiculo, 'placa'>): Promise<Veiculo | null>;
  /** Insere ou atualiza. */
  salvar(veiculo: Veiculo): Promise<void>;
  remover(filtro: Pick<Veiculo, 'id'>): Promise<void>;
}
