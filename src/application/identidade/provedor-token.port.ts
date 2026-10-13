import type { Usuario } from "@domain/identidade/usuario.aggregate";


export type ClaimsToken = { sub: Usuario['id']; papel: Usuario['papel'] };

export interface ProvedorToken {
  emitir(claims: ClaimsToken): Promise<string>;
}
