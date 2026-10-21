import type { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import type { OrdemServicoRepository } from '@domain/ordem-servico/ordem-servico.repository';
import type { BancoDados } from '@infrastructure/persistence/prisma-client';
import * as OrdemServicoMapper from './ordem-servico.mapper';

const POR_POSICAO = { orderBy: { posicao: 'asc' } } as const;

export class OrdemServicoRepositoryAdapter implements OrdemServicoRepository {
  /** `travar`: dentro de uma transação, `buscarPorId` segura a linha (FOR UPDATE) até o commit. */
  constructor(
    private readonly db: BancoDados,
    private readonly opcoes: { travar?: boolean } = {},
  ) {}

  async buscarPorId({ id }: Pick<OrdemServico, 'id'>): Promise<OrdemServico | null> {
    // trava antes de ler: em READ COMMITTED, quem esperou o lock lê o estado já confirmado
    if (this.opcoes.travar) await this.db.$queryRaw`SELECT 1 FROM ordens_servico WHERE id = ${id} FOR UPDATE`;
    const linha = await this.db.ordemServico.findUnique({ where: { id } });
    if (!linha) return null;
    // em sequência de propósito: num `include`, o Prisma carrega as filhas em paralelo, e dentro de uma
    // transação elas disputariam a mesma conexão (o `pg` já avisa que vai deixar de permitir isso)
    const itensServico = await this.db.itemServico.findMany({ where: { osId: id }, ...POR_POSICAO });
    const itensPeca = await this.db.itemPeca.findMany({ where: { osId: id }, ...POR_POSICAO });
    const historico = await this.db.registroStatus.findMany({ where: { osId: id }, ...POR_POSICAO });
    return OrdemServicoMapper.paraDominio({ ...linha, itensServico, itensPeca, historico });
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
