import type { Cliente } from './cliente.aggregate';

export interface ClienteRepository {
  buscarPorId(filtro: Pick<Cliente, 'id'>): Promise<Cliente | null>;
  buscarPorDocumento(filtro: Pick<Cliente, 'documento'>): Promise<Cliente | null>;
  /** Insere ou atualiza. */
  salvar(cliente: Cliente): Promise<void>;
  remover(filtro: Pick<Cliente, 'id'>): Promise<void>;
}
