import type { PublicadorEventos } from '@application/core/publicador-eventos.port';
import type { DomainEvent } from '@domain/core/domain-event';

/**
 * Lista de permissão: só `nome`, `ocorridoEm` e os campos de identificador (terminados em `Id`).
 * Um evento novo, com nome, documento ou placa, não vaza para o log sem ninguém decidir isso.
 */
export function paraLinhaDeLog(evento: DomainEvent): string {
  const ids = Object.entries(evento).filter(([campo]) => campo.endsWith('Id'));
  return JSON.stringify({
    evento: evento.nome,
    ocorridoEm: evento.ocorridoEm.toISOString(),
    ...Object.fromEntries(ids),
  });
}

/** No MVP não há broker: publicar é registrar uma linha de log por evento. */
export class LogPublicadorEventosAdapter implements PublicadorEventos {
  constructor(private readonly registrar: (linha: string) => void = console.info) {}

  async publicar(eventos: readonly DomainEvent[]): Promise<void> {
    for (const evento of eventos) this.registrar(paraLinhaDeLog(evento));
  }
}
