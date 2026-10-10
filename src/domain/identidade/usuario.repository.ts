import type { Usuario } from './usuario.aggregate';

export interface UsuarioRepository {
  buscarPorId(filtro: Pick<Usuario, 'id'>): Promise<Usuario | null>;
  buscarPorEmail(filtro: Pick<Usuario, 'email'>): Promise<Usuario | null>;
  /** Insere ou atualiza. */
  salvar(usuario: Usuario): Promise<void>;
}
