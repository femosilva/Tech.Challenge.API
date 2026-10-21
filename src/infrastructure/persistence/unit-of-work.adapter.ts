import type { RepositoriosTransacionais, UnitOfWork } from '@application/core/unit-of-work.port';
import { ClienteRepositoryAdapter } from './cadastro/cliente/cliente-repository.adapter';
import { PecaRepositoryAdapter } from './estoque/peca-repository.adapter';
import type { PrismaClient } from './generated/client';
import { OrdemServicoRepositoryAdapter } from './ordem-servico/ordem-servico-repository.adapter';

export class UnitOfWorkAdapter implements UnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  /** Se o trabalho lançar, o Prisma desfaz a transação e relança o mesmo erro. */
  executar<T>(trabalho: (repos: RepositoriosTransacionais) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) =>
      trabalho({
        // OS e peças são travadas ao serem lidas: aprovações concorrentes não perdem baixa nem baixam duas vezes
        ordens: new OrdemServicoRepositoryAdapter(tx, { travar: true }),
        pecas: new PecaRepositoryAdapter(tx, { travar: true }),
        clientes: new ClienteRepositoryAdapter(tx),
      }),
    );
  }
}
