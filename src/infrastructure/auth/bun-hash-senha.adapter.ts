import type { HashSenha } from '@application/identidade/hash-senha.port';

/** Argon2id do próprio Bun, sem dependência extra: o hash guarda algoritmo, custo e salt. */
export class BunHashSenhaAdapter implements HashSenha {
  /** Fora da porta: só quem cadastra usuário (o seed) precisa gerar hash. */
  gerar(senha: string): Promise<string> {
    return Bun.password.hash(senha);
  }

  async comparar(senha: string, hash: string): Promise<boolean> {
    try {
      return await Bun.password.verify(senha, hash);
    } catch {
      // hash malformado nunca autentica; o login segue devolvendo o erro genérico, sem 500
      return false;
    }
  }
}
