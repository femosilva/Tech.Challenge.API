import type { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import type { OrdemServicoRepository } from '@domain/ordem-servico/ordem-servico.repository';
import type { Prisma } from '@infrastructure/persistence/generated/client';
import type { BancoDados } from '@infrastructure/persistence/prisma-client';
import * as OrdemServicoMapper from './ordem-servico.mapper';

const POR_POSICAO = { orderBy: { posicao: 'asc' } } as const;
const COM_FILHAS = {
  itensServico: POR_POSICAO,
  itensPeca: POR_POSICAO,
  historico: POR_POSICAO,
} satisfies Prisma.OrdemServicoInclude;

export class OrdemServicoRepositoryAdapter implements OrdemServicoRepository {
  constructor(private readonly db: BancoDados) {}

  async buscarPorId({ id }: Pick<OrdemServico, 'id'>): Promise<OrdemServico | null> {
    const linha = await this.db.ordemServico.findUnique({ where: { id }, include: COM_FILHAS });
    return linha && OrdemServicoMapper.paraDominio(linha);
  }

  /**
   * Um único `upsert` com escrita aninhada: o Prisma o executa de forma atômica, e funciona tanto
   * com o client normal quanto com o de um `$transaction`. As filhas são apagadas e reinseridas.
   */
  async salvar(os: OrdemServico): Promise<void> {
    const { escalares, itensServico, itensPeca, historico } = OrdemServicoMapper.paraGravacao(os);
    const { id, ...campos } = escalares;
    await this.db.ordemServico.upsert({
      where: { id },
      create: {
        id,
        ...campos,
        itensServico: { create: itensServico },
        itensPeca: { create: itensPeca },
        historico: { create: historico },
      },
      update: {
        ...campos,
        itensServico: { deleteMany: {}, create: itensServico },
        itensPeca: { deleteMany: {}, create: itensPeca },
        historico: { deleteMany: {}, create: historico },
      },
    });
  }
}
