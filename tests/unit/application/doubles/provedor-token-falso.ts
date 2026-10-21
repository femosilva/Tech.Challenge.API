import type { ClaimsToken, ProvedorToken } from '@application/identidade/provedor-token.port';

export class ProvedorTokenFalso implements ProvedorToken {
  readonly emitidos: ClaimsToken[] = [];

  async emitir(claims: ClaimsToken): Promise<string> {
    this.emitidos.push(claims);
    return `token-de-${claims.sub}`;
  }
}
