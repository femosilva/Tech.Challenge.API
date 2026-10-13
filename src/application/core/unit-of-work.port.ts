import type { ClienteRepository } from '@domain/cadastro/cliente/cliente.repository';
import type { PecaRepository } from '@domain/estoque/peca.repository';
import type { OrdemServicoRepository } from '@domain/ordem-servico/ordem-servico.repository';

/** Só o que os casos de uso transacionais usam; cresce quando outro caso precisar. */
export type RepositoriosTransacionais = {
  ordens: OrdemServicoRepository;
  pecas: PecaRepository;
  clientes: ClienteRepository;
};

export interface UnitOfWork {
  /** Confirma se o trabalho terminar; desfaz tudo se ele lançar. */
  executar<T>(trabalho: (repos: RepositoriosTransacionais) => Promise<T>): Promise<T>;
}
