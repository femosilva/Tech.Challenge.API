import { Usuario } from '@domain/identidade/usuario.aggregate';
import type { Usuario as UsuarioLinha } from '@infrastructure/persistence/generated/client';

/** `restaurar` revalida o papel: papel desconhecido no banco falha aqui. */
export function paraDominio(linha: UsuarioLinha): Usuario {
  return Usuario.restaurar(linha);
}

export function paraLinha(usuario: Usuario): UsuarioLinha {
  return { id: usuario.id, email: usuario.email, senhaHash: usuario.senhaHash, papel: usuario.papel };
}
