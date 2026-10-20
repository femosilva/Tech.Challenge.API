import type {
  OrdemServicoDetalheDto,
  OrdemServicoResumoDto,
} from '@application/ordem-servico/ordem-servico-consultas.port';
import { StatusOS } from '@domain/value-objects/status-os.vo';
import type { Prisma } from '@infrastructure/persistence/generated/client';
import { orcamentoParaDominio } from './ordem-servico.mapper';

/** O que cada consulta lê do banco: só as colunas que o DTO usa. */
export const SELECAO_RESUMO = {
  id: true,
  clienteId: true,
  veiculoId: true,
  status: true,
  abertaEm: true,
  itensServico: { select: { precoUnitarioCentavos: true } },
  itensPeca: { select: { quantidade: true, precoUnitarioCentavos: true } },
} satisfies Prisma.OrdemServicoSelect;

export const SELECAO_DETALHE = {
  ...SELECAO_RESUMO,
  inicioExecucao: true,
  fimExecucao: true,
  orcamentoTotalCentavos: true,
  orcamentoGeradoEm: true,
  orcamentoEnviado: true,
  orcamentoDecisao: true,
  itensServico: {
    select: { servicoId: true, precoUnitarioCentavos: true },
    orderBy: { posicao: 'asc' },
  },
  itensPeca: {
    select: { pecaId: true, quantidade: true, precoUnitarioCentavos: true },
    orderBy: { posicao: 'asc' },
  },
  historico: { select: { status: true, alteradoEm: true }, orderBy: { posicao: 'asc' } },
} satisfies Prisma.OrdemServicoSelect;

export type LinhaResumo = Prisma.OrdemServicoGetPayload<{ select: typeof SELECAO_RESUMO }>;
export type LinhaDetalhe = Prisma.OrdemServicoGetPayload<{ select: typeof SELECAO_DETALHE }>;

/** O total é sempre a soma dos itens (invariante da OS); a consulta o recalcula sem montar o agregado. */
function totalCentavos({ itensServico, itensPeca }: Pick<LinhaResumo, 'itensServico' | 'itensPeca'>): number {
  const servicos = itensServico.reduce((soma, item) => soma + item.precoUnitarioCentavos, 0);
  return itensPeca.reduce((soma, item) => soma + item.quantidade * item.precoUnitarioCentavos, servicos);
}

export function paraResumoDto(linha: LinhaResumo): OrdemServicoResumoDto {
  return {
    id: linha.id,
    clienteId: linha.clienteId,
    veiculoId: linha.veiculoId,
    status: StatusOS.de(linha.status).valor,
    totalCentavos: totalCentavos(linha),
    abertaEm: linha.abertaEm,
  };
}

export function paraDetalheDto(linha: LinhaDetalhe): OrdemServicoDetalheDto {
  const orcamento = orcamentoParaDominio(linha);
  return {
    ...paraResumoDto(linha),
    itensServico: linha.itensServico,
    itensPeca: linha.itensPeca,
    orcamento: orcamento
      ? { totalCentavos: orcamento.total.centavos, enviado: orcamento.enviado, decisao: orcamento.decisao }
      : null,
    historico: linha.historico.map((registro) => ({
      status: StatusOS.de(registro.status).valor,
      alteradoEm: registro.alteradoEm,
    })),
    inicioExecucao: linha.inicioExecucao,
    fimExecucao: linha.fimExecucao,
  };
}
