export interface HashSenha {
  /**
   * `hash` nulo quer dizer "usuário inexistente": o adapter gasta o mesmo tempo de uma verificação real e
   * devolve false, para o tempo da resposta não revelar quais e-mails estão cadastrados.
   */
  comparar(senha: string, hash: string | null): Promise<boolean>;
}
