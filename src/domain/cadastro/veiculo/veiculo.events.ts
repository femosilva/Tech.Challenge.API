import type { DomainEvent } from '@domain/core/domain-event';

export type VeiculoRegistrado = DomainEvent<
  'VeiculoRegistrado',
  { veiculoId: string; clienteId: string }
>;

export type VeiculoEvent = VeiculoRegistrado;
