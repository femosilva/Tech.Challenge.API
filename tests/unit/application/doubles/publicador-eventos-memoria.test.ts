import type { PublicadorEventos } from '@application/core/publicador-eventos.port';
import type { DomainEvent } from '@domain/core/domain-event';

export class PublicadorEventosEmMemoria implements PublicadorEventos {
  readonly publicados: DomainEvent[] = [];

  async publicar(eventos: readonly DomainEvent[]): Promise<void> {
    this.publicados.push(...eventos);
  }

  get nomes(): string[] {
    return this.publicados.map((e) => e.nome);
  }
}
