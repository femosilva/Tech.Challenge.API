import type { ClienteConsultas, ClienteDto } from '@application/cadastro/cliente/cliente-consultas.port';
import type { Prisma } from '../../generated/client';
import type { BancoDados } from '../../prisma-client';

const SELECAO = { id: true, nome: true, documento: true } satisfies Prisma.ClienteSelect;

export class ClienteConsultasAdapter implements ClienteConsultas {
  constructor(private readonly db: BancoDados) {}

  listar(): Promise<ClienteDto[]> {
    return this.db.cliente.findMany({ select: SELECAO, orderBy: { nome: 'asc' } });
  }

  obter({ id }: Pick<ClienteDto, 'id'>): Promise<ClienteDto | null> {
    return this.db.cliente.findUnique({ where: { id }, select: SELECAO });
  }
}
