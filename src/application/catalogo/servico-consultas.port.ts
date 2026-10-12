import type { Servico } from '@domain/catalogo/servico.aggregate';

export type ServicoDto = Pick<Servico, 'id' | 'nome'> & { precoCentavos: number };

export interface ServicoConsultas {
  listar(): Promise<ServicoDto[]>;
  obter(filtro: Pick<Servico, 'id'>): Promise<ServicoDto | null>;
}
