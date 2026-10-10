import type { OrdemServico } from './ordem-servico.aggregate';

export interface OrdemServicoRepository {
  buscarPorId(filtro: Pick<OrdemServico, 'id'>): Promise<OrdemServico | null>;
  /** Insere ou atualiza. */
  salvar(os: OrdemServico): Promise<void>;
}
