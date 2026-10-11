import type { DomainEvent } from '@domain/core/domain-event';

export interface PublicadorEventos {
  publicar(eventos: readonly DomainEvent[]): Promise<void>;
}
