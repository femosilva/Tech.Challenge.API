import type { Servico } from '@domain/catalogo/servico.aggregate';
import type { Peca } from '@domain/estoque/peca.aggregate';
import type { Orcamento } from '@domain/ordem-servico/orcamento.vo';
import type { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import type { StatusOSValor } from '@domain/value-objects/status-os.vo';

export type Paginacao = { pagina: number; tamanho: number };
export type Pagina<T> = Paginacao & { itens: T[]; total: number };

export type OrdemServicoResumoDto = Pick<OrdemServico, 'id' | 'clienteId' | 'veiculoId'> & {
  status: StatusOSValor;
  totalCentavos: number;
  abertaEm: Date;
};

export type OrdemServicoDetalheDto = OrdemServicoResumoDto & {
  itensServico: { servicoId: Servico['id']; precoUnitarioCentavos: number }[];
  itensPeca: { pecaId: Peca['id']; quantidade: number; precoUnitarioCentavos: number }[];
  orcamento: (Pick<Orcamento, 'enviado' | 'decisao'> & { totalCentavos: number }) | null;
  historico: { status: StatusOSValor; alteradoEm: Date }[];
  inicioExecucao: Date | null;
  fimExecucao: Date | null;
};

/** Só OS com execução concluída entram na média. `mediaMs` é null quando nenhuma entrou. */
export type TempoMedioExecucaoDto = { ordensConsideradas: number; mediaMs: number | null };

export interface OrdemServicoConsultas {
  /** Mais recentes primeiro. */
  listar(paginacao: Paginacao): Promise<Pagina<OrdemServicoResumoDto>>;
  detalhar(filtro: Pick<OrdemServico, 'id'>): Promise<OrdemServicoDetalheDto | null>;
  tempoMedioExecucao(): Promise<TempoMedioExecucaoDto>;
  existePorCliente(filtro: Pick<OrdemServico, 'clienteId'>): Promise<boolean>;
  existePorVeiculo(filtro: Pick<OrdemServico, 'veiculoId'>): Promise<boolean>;
  existePorServico(filtro: Pick<Servico, 'id'>): Promise<boolean>;
  existePorPeca(filtro: Pick<Peca, 'id'>): Promise<boolean>;
}
