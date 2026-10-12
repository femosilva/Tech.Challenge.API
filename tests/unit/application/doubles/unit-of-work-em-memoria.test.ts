import type { RepositoriosTransacionais, UnitOfWork } from '@application/core/unit-of-work.port';
import type { OrdemServicoRepositorioEmMemoria, PecaRepositorioEmMemoria } from './repositorios-em-memoria.test';

type Repositorios = { ordens: OrdemServicoRepositorioEmMemoria; pecas: PecaRepositorioEmMemoria };

/** Simula rollback: se o trabalho lançar, restaura os repositórios ao estado de antes. */
export class UnitOfWorkEmMemoria implements UnitOfWork {
  constructor(private readonly repos: Repositorios) {}

  async executar<T>(trabalho: (repos: RepositoriosTransacionais) => Promise<T>): Promise<T> {
    const desfazer = [this.repos.ordens.snapshot(), this.repos.pecas.snapshot()];
    try {
      return await trabalho(this.repos);
    } catch (erro) {
      for (const restaurar of desfazer) restaurar();
      throw erro;
    }
  }
}
