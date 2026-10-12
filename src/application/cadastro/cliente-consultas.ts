import type { Cliente } from '@domain/cadastro/cliente/cliente.aggregate';

export type ClienteDto = Pick<Cliente, 'id' | 'nome'> & { documento: string };

export interface ClienteConsultas {
  listar(): Promise<ClienteDto[]>;
  obter(filtro: Pick<Cliente, 'id'>): Promise<ClienteDto | null>;
}
