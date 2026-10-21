import type { ClaimsToken, ProvedorToken } from '@application/identidade/provedor-token.port';
import { SignJWT } from 'jose';
import type { ConfigJwt } from './config-jwt';

/** O guard da Presentation valida o token com este mesmo algoritmo e o mesmo segredo. */
export const ALGORITMO_JWT = 'HS256';

export class JwtProvedorTokenAdapter implements ProvedorToken {
  private readonly chave: Uint8Array;

  constructor(private readonly config: ConfigJwt) {
    this.chave = new TextEncoder().encode(config.segredo);
  }

  emitir({ sub, papel }: ClaimsToken): Promise<string> {
    return new SignJWT({ papel })
      .setProtectedHeader({ alg: ALGORITMO_JWT })
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime(this.config.expiracao)
      .sign(this.chave);
  }
}
