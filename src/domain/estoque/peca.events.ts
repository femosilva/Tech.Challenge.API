import type { DomainEvent } from '@domain/core/domain-event';

export type PecaCadastrada = DomainEvent<'PecaCadastrada', { pecaId: string }>;
export type EstoqueReposto = DomainEvent<'EstoqueReposto', { pecaId: string; quantidade: number }>;
export type EstoqueBaixado = DomainEvent<'EstoqueBaixado', { pecaId: string; quantidade: number }>;

export type PecaEvent = PecaCadastrada | EstoqueReposto | EstoqueBaixado;
