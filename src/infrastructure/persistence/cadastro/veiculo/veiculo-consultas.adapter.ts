import type { VeiculoConsultas, VeiculoDto } from '@application/cadastro/veiculo/veiculo-consultas.port';
import type { Prisma } from '@infrastructure/persistence/generated/client';
import type { BancoDados } from '@infrastructure/persistence/prisma-client';

const SELECAO = { id: true, clienteId: true, placa: true, marca: true, modelo: true, ano: true } satisfies Prisma.VeiculoSelect;

export class VeiculoConsultasAdapter implements VeiculoConsultas {
  constructor(private readonly db: BancoDados) {}

  listar(): Promise<VeiculoDto[]> {
    return this.db.veiculo.findMany({ select: SELECAO, orderBy: { placa: 'asc' } });
  }

  obter({ id }: Pick<VeiculoDto, 'id'>): Promise<VeiculoDto | null> {
    return this.db.veiculo.findUnique({ where: { id }, select: SELECAO });
  }

  listarPorCliente({ clienteId }: Pick<VeiculoDto, 'clienteId'>): Promise<VeiculoDto[]> {
    return this.db.veiculo.findMany({ where: { clienteId }, select: SELECAO, orderBy: { placa: 'asc' } });
  }

  async existePorCliente({ clienteId }: Pick<VeiculoDto, 'clienteId'>): Promise<boolean> {
    return (await this.db.veiculo.findFirst({ where: { clienteId }, select: { id: true } })) !== null;
  }
}
