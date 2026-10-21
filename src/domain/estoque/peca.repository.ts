import type { Peca } from './peca.aggregate';

export interface PecaRepository {
  buscarPorId(filtro: Pick<Peca, 'id'>): Promise<Peca | null>;
  buscarPorCodigo(filtro: Pick<Peca, 'codigo'>): Promise<Peca | null>;
  /** Insere ou atualiza. */
  salvar(peca: Peca): Promise<void>;
  remover(filtro: Pick<Peca, 'id'>): Promise<void>;
}
