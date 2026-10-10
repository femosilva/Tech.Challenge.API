import type { DomainEvent } from '@domain/core/domain-event';

export type ServicoCadastrado = DomainEvent<'ServicoCadastrado', { servicoId: string }>;

export type ServicoEvent = ServicoCadastrado;
