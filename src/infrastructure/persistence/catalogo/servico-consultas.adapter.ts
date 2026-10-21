import type { ServicoConsultas, ServicoDto } from '@application/catalogo/servico-consultas.port';
import type { Prisma } from '@infrastructure/persistence/generated/client';
import type { BancoDados } from '@infrastructure/persistence/prisma-client';

const SELECAO = { id: true, nome: true, precoCentavos: true } satisfies Prisma.ServicoSelect;

export class ServicoConsultasAdapter implements ServicoConsultas {
  constructor(private readonly db: BancoDados) {}

  listar(): Promise<ServicoDto[]> {
    return this.db.servico.findMany({ select: SELECAO, orderBy: { nome: 'asc' } });
  }

  obter({ id }: Pick<ServicoDto, 'id'>): Promise<ServicoDto | null> {
    return this.db.servico.findUnique({ where: { id }, select: SELECAO });
  }
}
