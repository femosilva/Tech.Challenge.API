export interface HashSenha {
  comparar(senha: string, hash: string): Promise<boolean>;
}
