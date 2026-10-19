import { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';
import type { Cliente as ClienteLinha } from './generated/client';

/** `restaurar` revalida o documento: linha corrompida no banco falha aqui, não adiante. */
export function paraDominio(linha: ClienteLinha): Cliente {
  return Cliente.restaurar(linha);
}

export function paraLinha(cliente: Cliente): ClienteLinha {
  return { id: cliente.id, nome: cliente.nome, documento: cliente.documento.numero };
}
