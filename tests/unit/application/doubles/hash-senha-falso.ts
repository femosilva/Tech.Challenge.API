import type { HashSenha } from '@application/identidade/hash-senha.port';

/** "Hash" previsível para os testes: o hash de uma senha é `hash:<senha>`. */
export const hashFalso = (senha: string): string => `hash:${senha}`;

export class HashSenhaFalso implements HashSenha {
  async comparar(senha: string, hash: string): Promise<boolean> {
    return hash === hashFalso(senha);
  }
}
