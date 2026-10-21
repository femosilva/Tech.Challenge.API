import type { Servico } from './servico.aggregate';

export interface ServicoRepository {
  buscarPorId(filtro: Pick<Servico, 'id'>): Promise<Servico | null>;
  /** Insere ou atualiza. */
  salvar(servico: Servico): Promise<void>;
  remover(filtro: Pick<Servico, 'id'>): Promise<void>;
}
