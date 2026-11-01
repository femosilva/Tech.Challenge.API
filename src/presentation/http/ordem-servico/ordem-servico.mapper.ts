import type { OrdemServicoDetalheDto, OrdemServicoResumoDto, Pagina } from '@application/ordem-servico';

const iso = (data: Date) => data.toISOString();

/** A API devolve datas em ISO 8601 (UTC); os DTOs da Application usam `Date`. */
export const resumoParaResposta = (os: OrdemServicoResumoDto) => ({ ...os, abertaEm: iso(os.abertaEm) });

export const detalheParaResposta = (os: OrdemServicoDetalheDto) => ({
  ...os,
  abertaEm: iso(os.abertaEm),
  inicioExecucao: os.inicioExecucao && iso(os.inicioExecucao),
  fimExecucao: os.fimExecucao && iso(os.fimExecucao),
  historico: os.historico.map((registro) => ({ ...registro, alteradoEm: iso(registro.alteradoEm) })),
});

export const paginaParaResposta = (pagina: Pagina<OrdemServicoResumoDto>) => ({
  ...pagina,
  itens: pagina.itens.map(resumoParaResposta),
});
