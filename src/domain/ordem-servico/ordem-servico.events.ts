import type { DomainEvent } from '@domain/core/domain-event';

export type OSAberta = DomainEvent<'OSAberta', { osId: string }>;
export type DiagnosticoIniciado = DomainEvent<'DiagnosticoIniciado', { osId: string }>;
export type ServicoIncluido = DomainEvent<'ServicoIncluido', { osId: string; servicoId: string }>;
export type PecaIncluida = DomainEvent<'PecaIncluida', { osId: string; pecaId: string }>;
export type OrcamentoGerado = DomainEvent<'OrcamentoGerado', { osId: string; total: number }>;
export type OrcamentoEnviado = DomainEvent<'OrcamentoEnviado', { osId: string }>;
export type OrcamentoAprovado = DomainEvent<'OrcamentoAprovado', { osId: string }>;
export type OrcamentoRejeitado = DomainEvent<'OrcamentoRejeitado', { osId: string }>;
export type ExecucaoIniciada = DomainEvent<'ExecucaoIniciada', { osId: string }>;
export type OSFinalizada = DomainEvent<'OSFinalizada', { osId: string }>;
export type VeiculoEntregue = DomainEvent<'VeiculoEntregue', { osId: string }>;

export type OrdemServicoEvent =
  | OSAberta
  | DiagnosticoIniciado
  | ServicoIncluido
  | PecaIncluida
  | OrcamentoGerado
  | OrcamentoEnviado
  | OrcamentoAprovado
  | OrcamentoRejeitado
  | ExecucaoIniciada
  | OSFinalizada
  | VeiculoEntregue;
