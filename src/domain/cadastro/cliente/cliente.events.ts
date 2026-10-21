import type { DomainEvent } from "@domain/core/domain-event";

export type ClienteCadastrado = DomainEvent<
    "ClienteCadastrado",
    { clienteId: string }
>;

export type ClienteEvent = ClienteCadastrado;
