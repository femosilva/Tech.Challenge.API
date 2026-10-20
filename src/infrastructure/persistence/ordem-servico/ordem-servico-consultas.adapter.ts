import type {
  OrdemServicoConsultas,
  OrdemServicoDetalheDto,
  OrdemServicoResumoDto,
  Pagina,
  Paginacao,
  TempoMedioExecucaoDto,
} from '@application/ordem-servico/ordem-servico-consultas.port';
import type { Servico } from '@domain/catalogo/servico.aggregate';
import type { Peca } from '@domain/estoque/peca.aggregate';
import type { BancoDados } from '@infrastructure/persistence/prisma-client';
import { paraDetalheDto, paraResumoDto, SELECAO_DETALHE, SELECAO_RESUMO } from './ordem-servico-dto.mapper';

export class OrdemServicoConsultasAdapter implements OrdemServicoConsultas {
  constructor(private readonly db: BancoDados) {}

  async listar({ pagina, tamanho }: Paginacao): Promise<Pagina<OrdemServicoResumoDto>> {
    const [linhas, total] = await Promise.all([
      this.db.ordemServico.findMany({
        select: SELECAO_RESUMO,
        // `id` desempata OS abertas no mesmo instante, para a paginação não repetir nem pular itens
        orderBy: [{ abertaEm: 'desc' }, { id: 'asc' }],
        skip: (pagina - 1) * tamanho,
        take: tamanho,
      }),
      this.db.ordemServico.count(),
    ]);
    return { pagina, tamanho, total, itens: linhas.map(paraResumoDto) };
  }

  async detalhar({ id }: Pick<OrdemServicoDetalheDto, 'id'>): Promise<OrdemServicoDetalheDto | null> {
    const linha = await this.db.ordemServico.findUnique({ where: { id }, select: SELECAO_DETALHE });
    return linha && paraDetalheDto(linha);
  }

  async tempoMedioExecucao(): Promise<TempoMedioExecucaoDto> {
    const [resultado] = await this.db.$queryRaw<TempoMedioExecucaoDto[]>`
      SELECT COUNT(*)::int AS "ordensConsideradas",
             AVG(EXTRACT(EPOCH FROM (fim_execucao - inicio_execucao)) * 1000)::float8 AS "mediaMs"
      FROM ordens_servico
      WHERE inicio_execucao IS NOT NULL AND fim_execucao IS NOT NULL`;
    // agregação sem GROUP BY sempre devolve exatamente uma linha
    return resultado!;
  }

  async existePorCliente({ clienteId }: Pick<OrdemServicoResumoDto, 'clienteId'>): Promise<boolean> {
    return (await this.db.ordemServico.findFirst({ where: { clienteId }, select: { id: true } })) !== null;
  }

  async existePorVeiculo({ veiculoId }: Pick<OrdemServicoResumoDto, 'veiculoId'>): Promise<boolean> {
    return (await this.db.ordemServico.findFirst({ where: { veiculoId }, select: { id: true } })) !== null;
  }

  async existePorServico({ id }: Pick<Servico, 'id'>): Promise<boolean> {
    return (await this.db.itemServico.findFirst({ where: { servicoId: id }, select: { osId: true } })) !== null;
  }

  async existePorPeca({ id }: Pick<Peca, 'id'>): Promise<boolean> {
    return (await this.db.itemPeca.findFirst({ where: { pecaId: id }, select: { osId: true } })) !== null;
  }
}
