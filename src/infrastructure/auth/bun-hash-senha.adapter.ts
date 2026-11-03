import type { HashSenha } from '@application/identidade/hash-senha.port';

/** Argon2id do próprio Bun, sem dependência extra: o hash guarda algoritmo, custo e salt. */
export class BunHashSenhaAdapter implements HashSenha {
  /**
   * Hash de uma senha aleatória, com o mesmo custo dos reais. Serve para gastar o mesmo tempo quando o
   * usuário não existe. A promessa começa na construção, então o primeiro login não paga o custo extra.
   */
  private readonly hashDeReferencia: Promise<string> = this.gerar(crypto.randomUUID());

  /** Fora da porta: só quem cadastra usuário (o seed) precisa gerar hash. */
  gerar(senha: string): Promise<string> {
    return Bun.password.hash(senha);
  }

  async comparar(senha: string, hash: string | null): Promise<boolean> {
    try {
      const confere = await Bun.password.verify(senha, hash ?? (await this.hashDeReferencia));
      return hash !== null && confere;
    } catch {
      // hash malformado nunca autentica; o login segue devolvendo o erro genérico, sem 500
      return false;
    }
  }
}
