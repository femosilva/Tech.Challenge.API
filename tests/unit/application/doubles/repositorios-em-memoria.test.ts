import type { AggregateRoot } from '@domain/core/aggregate-root';
import type { Peca } from '@domain/estoque/peca.aggregate';
import type { PecaRepository } from '@domain/estoque/peca.repository';
import type { OrdemServico } from '@domain/ordem-servico/ordem-servico.aggregate';
import type { OrdemServicoRepository } from '@domain/ordem-servico/ordem-servico.repository';
import { clonar } from './clonar';

/**
 * Guarda e devolve cópias, como um banco de verdade: alterar o que foi carregado
 * não muda o que está guardado até chamar salvar.
 */
export abstract class RepositorioEmMemoria<T extends AggregateRoot> {
  protected itens = new Map<string, T>();

  async buscarPorId(filtro: Pick<T, 'id'>): Promise<T | null> {
    const item = this.itens.get(filtro.id);
    return item ? clonar(item) : null;
  }

  async salvar(item: T): Promise<void> {
    const copia = clonar(item);
    copia.puxarEventos(); // eventos pendentes não são persistidos
    this.itens.set(item.id, copia);
  }

  async remover(filtro: Pick<T, 'id'>): Promise<void> {
    this.itens.delete(filtro.id);
  }

  /** Devolve a função que restaura o estado de agora. */
  snapshot(): () => void {
    const copia = new Map(this.itens);
    return () => {
      this.itens = copia;
    };
  }

  protected buscarUm(predicado: (item: T) => boolean): T | null {
    for (const item of this.itens.values()) if (predicado(item)) return clonar(item);
    return null;
  }
}

export class PecaRepositorioEmMemoria extends RepositorioEmMemoria<Peca> implements PecaRepository {
  async buscarPorCodigo(filtro: Pick<Peca, 'codigo'>): Promise<Peca | null> {
    return this.buscarUm((p) => p.codigo === filtro.codigo);
  }
}

export class OrdemServicoRepositorioEmMemoria
  extends RepositorioEmMemoria<OrdemServico>
  implements OrdemServicoRepository {}
