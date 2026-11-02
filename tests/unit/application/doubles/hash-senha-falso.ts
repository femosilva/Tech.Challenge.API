import type { HashSenha } from '@application/identidade/hash-senha.port';

/** "Hash" previsível para os testes: o hash de uma senha é `hash:<senha>`. */
export const hashFalso = (senha: string): string => `hash:${senha}`;

export class HashSenhaFalso implements HashSenha {
  /** Cada comparação pedida, na ordem; `null` é a comparação feita quando o usuário não existe. */
  readonly hashesComparados: (string | null)[] = [];

  async comparar(senha: string, hash: string | null): Promise<boolean> {
    this.hashesComparados.push(hash);
    return hash !== null && hash === hashFalso(senha);
  }
}
