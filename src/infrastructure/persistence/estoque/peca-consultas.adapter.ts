import type { PecaConsultas, PecaDto } from '@application/estoque/peca-consultas.port';
import type { Prisma } from '@infrastructure/persistence/generated/client';
import type { BancoDados } from '@infrastructure/persistence/prisma-client';

const SELECAO = { id: true, codigo: true, nome: true, precoCentavos: true, saldo: true } satisfies Prisma.PecaSelect;

export class PecaConsultasAdapter implements PecaConsultas {
  constructor(private readonly db: BancoDados) {}

  listar(): Promise<PecaDto[]> {
    return this.db.peca.findMany({ select: SELECAO, orderBy: { nome: 'asc' } });
  }

  obter({ id }: Pick<PecaDto, 'id'>): Promise<PecaDto | null> {
    return this.db.peca.findUnique({ where: { id }, select: SELECAO });
  }
}
