import type { DomainEvent } from "./domain-event";
import { Entity } from "./entity";

export abstract class AggregateRoot<
    Evento extends DomainEvent = DomainEvent,
> extends Entity {
    private eventos: Evento[] = [];

    protected registrar(evento: Evento): void {
        this.eventos.push(evento);
    }

    /** Entrega e limpa os eventos pendentes; a Application decide o que fazer com eles. */
    puxarEventos(): Evento[] {
        const pendentes = this.eventos;
        this.eventos = [];
        return pendentes;
    }
}
